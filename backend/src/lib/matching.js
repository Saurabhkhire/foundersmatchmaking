import { MatchType, UserRole } from "@prisma/client";
import { prisma } from "./prisma.js";
import { mapLimit } from "./concurrency.js";
import { buildMatchExplanation, embeddingFromText, extractFounderMetadata, extractInvestorMetadata } from "./openai.js";

export const MIN_SCORE = 65;

const EMBEDDINGS_CONCURRENCY = Math.max(1, Number(process.env.MATCH_CONCURRENCY_EMBEDDINGS || "10"));
const EXPLANATIONS_CONCURRENCY = Math.max(1, Number(process.env.MATCH_CONCURRENCY_EXPLANATIONS || "8"));
const SKIP_AI_EXPLANATIONS =
  process.env.MATCH_SKIP_AI_EXPLANATIONS === "1" || process.env.MATCH_SKIP_AI_EXPLANATIONS === "true";

export const DEFAULT_MATCH_QUESTIONS = [
  "What tactical outcome do you want from this conversation?",
  "What bottleneck can each of you help solve quickly?",
  "What next step can you commit to in one week?",
];

function overlapScore(a, b, max) {
  const left = String(a || "").toLowerCase();
  const right = String(b || "").toLowerCase();
  if (!left || !right) return 0;
  if (left === right) return max;
  return (left.includes(right) || right.includes(left)) ? Math.round(max * 0.7) : 0;
}

/** Fields 5–6 (Looking for, Can help) drive the largest share of the score. */
export function scoreFounderFounderProfiles(a, b) {
  const score = overlapScore(a.lookingFor, b.canHelp, 38)
    + overlapScore(b.lookingFor, a.canHelp, 38)
    + overlapScore(a.industryType, b.industryType, 12)
    + overlapScore(a.moneyRaised, b.moneyRaised, 10)
    + overlapScore(a.icp, b.icp, 10)
    + overlapScore(a.gtm, b.gtm, 8)
    + overlapScore(a.biggestBottleneck, b.canHelp, 6)
    + overlapScore(b.biggestBottleneck, a.canHelp, 6)
    + overlapScore(a.stage, b.stage, 8)
    + overlapScore(a.revenue, b.revenue, 8)
    + (Math.abs(a.teamSize - b.teamSize) <= 3 ? 2 : 0)
    + (Math.abs(a.usersCount - b.usersCount) <= 500 ? 2 : 0);
  return Math.min(score, 100);
}

function founderInvestorScore(founder, investor) {
  const redFlags = String(investor.redFlags || "").toLowerCase();
  if (redFlags && String(founder.startupOneLiner || "").toLowerCase().includes(redFlags)) return 0;

  const priority =
    overlapScore(founder.lookingFor, investor.investmentInterest, 24)
    + overlapScore(founder.lookingFor, investor.usersPreference, 24)
    + overlapScore(founder.canHelp, investor.investmentInterest, 20)
    + overlapScore(founder.canHelp, investor.usersPreference, 20);

  const secondary =
    overlapScore(founder.industryType, investor.preferredSector, 18)
    + overlapScore(founder.icp, investor.preferredSector, 14)
    + overlapScore(founder.stage, investor.preferredStage, 10)
    + overlapScore(founder.revenue, investor.tractionExpectation, 10)
    + overlapScore(founder.moneyRaised, investor.tractionExpectation, 10)
    + overlapScore(founder.startupOneLiner, investor.investmentInterest, 8)
    + overlapScore(founder.biggestBottleneck, investor.investmentInterest, 6)
    + overlapScore(founder.startupOneLiner, founder.gtm, 4)
    + (founder.usersCount > 0 || String(founder.revenue || "").toLowerCase() !== "pre-revenue" ? 4 : 0);

  return Math.min(priority + secondary, 100);
}

/** Used by emails and tools to score a founder vs investor without a persisted Match row. */
export function scoreFounderInvestorProfiles(founder, investor) {
  return founderInvestorScore(founder, investor);
}

function investorInvestorScore(a, b) {
  const score = overlapScore(a.usersPreference, b.usersPreference, 32)
    + overlapScore(a.investmentInterest, b.investmentInterest, 28)
    + overlapScore(a.preferredSector, b.preferredSector, 22)
    + overlapScore(a.preferredStage, b.preferredStage, 12)
    + overlapScore(a.tractionExpectation, b.tractionExpectation, 8);
  return Math.min(score, 100);
}

async function refreshEmbeddings() {
  const [founders, investors] = await Promise.all([
    prisma.founderProfile.findMany(),
    prisma.investorProfile.findMany(),
  ]);

  async function refreshFounder(founder) {
    const content = [founder.startupOneLiner, founder.industryType, founder.icp, founder.gtm, founder.biggestBottleneck, founder.lookingFor, founder.canHelp, founder.stage, founder.revenue, founder.moneyRaised].join(" | ");
    const [embedding, extractedData] = await Promise.all([
      embeddingFromText(content),
      extractFounderMetadata(content),
    ]);
    await prisma.$executeRaw`UPDATE "FounderProfile" SET "embedding" = ${`[${embedding.join(",")}]`}::vector WHERE "id" = ${founder.id}`;
    await prisma.founderProfile.update({ where: { id: founder.id }, data: { extractedData } });
  }

  async function refreshInvestor(investor) {
    const content = [investor.preferredSector, investor.preferredStage, investor.tractionExpectation, investor.investmentInterest, investor.redFlags, investor.usersPreference].join(" | ");
    const [embedding, extractedData] = await Promise.all([
      embeddingFromText(content),
      extractInvestorMetadata(content),
    ]);
    await prisma.$executeRaw`UPDATE "InvestorProfile" SET "embedding" = ${`[${embedding.join(",")}]`}::vector WHERE "id" = ${investor.id}`;
    await prisma.investorProfile.update({ where: { id: investor.id }, data: { extractedData } });
  }

  await Promise.all([
    mapLimit(founders, EMBEDDINGS_CONCURRENCY, refreshFounder),
    mapLimit(investors, EMBEDDINGS_CONCURRENCY, refreshInvestor),
  ]);
}

function orderPairUsers(u1, u2) {
  return u1.id.localeCompare(u2.id) <= 0 ? [u1, u2] : [u2, u1];
}

/**
 * Room partners are mandatory (no score cutoff): repeatedly pair the two unmatched founders
 * with the highest pairwise score until at most one remains (odd cohort).
 */
function mandatoryFounderRoomPairs(founders) {
  if (founders.length < 2) return [];

  const unmatched = new Set(founders.map((f) => f.id));
  const byId = new Map(founders.map((f) => [f.id, f]));
  const out = [];

  while (unmatched.size >= 2) {
    const ids = [...unmatched];
    let bestScore = -1;
    let pick = null;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const fa = byId.get(ids[i]);
        const fb = byId.get(ids[j]);
        const sc = scoreFounderFounderProfiles(fa.founderProfile, fb.founderProfile);
        if (sc > bestScore) {
          bestScore = sc;
          pick = [fa, fb];
        }
      }
    }
    if (!pick) break;
    const [x, y] = pick;
    unmatched.delete(x.id);
    unmatched.delete(y.id);
    const [a, b] = orderPairUsers(x, y);
    out.push({
      a,
      b,
      matchType: MatchType.founder_founder,
      score: bestScore,
      highlights: ["Reciprocal need/help fit", "ICP and GTM overlap"],
    });
  }

  if (unmatched.size === 1) {
    const lone = [...unmatched][0];
    console.warn(
      `[matching] Odd founder count — cannot assign a room partner to user ${lone} (1v1 pairing needs an even number of founders).`,
    );
  }

  return out;
}

export async function runMatching() {
  await prisma.match.deleteMany({});
  await refreshEmbeddings();

  const users = await prisma.user.findMany({ include: { founderProfile: true, investorProfile: true } });
  const founders = users.filter((u) => u.role === UserRole.founder && u.founderProfile);
  const investors = users.filter((u) => u.role === UserRole.investor && u.investorProfile);

  const ffSelected = mandatoryFounderRoomPairs(founders);
  const candidates = [...ffSelected];

  for (const f of founders) {
    for (const inv of investors) {
      const score = founderInvestorScore(f.founderProfile, inv.investorProfile);
      if (score < MIN_SCORE) continue;
      const [a, b] = orderPairUsers(f, inv);
      candidates.push({
        a,
        b,
        matchType: MatchType.founder_investor,
        score,
        highlights: ["Sector and stage fit", "Traction expectation alignment"],
      });
    }
  }

  for (let i = 0; i < investors.length; i++) {
    for (let j = i + 1; j < investors.length; j++) {
      const x = investors[i];
      const y = investors[j];
      const score = investorInvestorScore(x.investorProfile, y.investorProfile);
      if (score < MIN_SCORE) continue;
      const [a, b] = orderPairUsers(x, y);
      candidates.push({
        a,
        b,
        matchType: MatchType.investor_investor,
        score,
        highlights: ["Sector and stage overlap", "Co-investment thesis alignment"],
      });
    }
  }

  let explanations;
  if (SKIP_AI_EXPLANATIONS) {
    explanations = candidates.map((c) => ({
      whyMatched: c.highlights,
      questions: DEFAULT_MATCH_QUESTIONS,
    }));
  } else {
    explanations = await mapLimit(candidates, EXPLANATIONS_CONCURRENCY, (c) =>
      buildMatchExplanation({ roleA: c.a.role, roleB: c.b.role, score: c.score, highlights: c.highlights }),
    );
  }

  const inserts = candidates.map((c, idx) => {
    const ai = explanations[idx];
    return prisma.match.create({
      data: {
        userAId: c.a.id,
        userBId: c.b.id,
        matchType: c.matchType,
        score: c.score,
        aiReason: (ai.whyMatched || c.highlights).join(" | "),
        aiQuestions: ai.questions?.length ? ai.questions : DEFAULT_MATCH_QUESTIONS,
      },
    });
  });

  await Promise.all(inserts);
}
