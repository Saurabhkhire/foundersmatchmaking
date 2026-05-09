import { MatchType, UserRole } from "@prisma/client";
import { prisma } from "./prisma.js";
import { mapLimit } from "./concurrency.js";
import { buildMatchExplanation, buildMatchScore, embeddingFromText, extractFounderMetadata, extractInvestorMetadata } from "./openai.js";

export const MIN_SCORE = 65;

const EMBEDDINGS_CONCURRENCY = Math.max(1, Number(process.env.MATCH_CONCURRENCY_EMBEDDINGS || "10"));
const EXPLANATIONS_CONCURRENCY = Math.max(1, Number(process.env.MATCH_CONCURRENCY_EXPLANATIONS || "8"));
const SCORE_CONCURRENCY = Math.max(1, Number(process.env.MATCH_CONCURRENCY_SCORES || "8"));
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

function compactFounderProfile(p) {
  return {
    startupOneLiner: p.startupOneLiner,
    industryType: p.industryType,
    icp: p.icp,
    gtm: p.gtm,
    biggestBottleneck: p.biggestBottleneck,
    lookingFor: p.lookingFor,
    canHelp: p.canHelp,
    stage: p.stage,
    revenue: p.revenue,
    moneyRaised: p.moneyRaised,
    teamSize: p.teamSize,
    usersCount: p.usersCount,
    linkedinUrl: p.linkedinUrl,
  };
}

function compactInvestorProfile(p) {
  return {
    preferredSector: p.preferredSector,
    preferredStage: p.preferredStage,
    tractionExpectation: p.tractionExpectation,
    investmentInterest: p.investmentInterest,
    redFlags: p.redFlags,
    usersPreference: p.usersPreference,
    linkedinUrl: p.linkedinUrl,
  };
}

function clampScore(n) {
  return Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
}

async function llmScoreCandidate(c, baseScore, hints) {
  const scored = await buildMatchScore({
    matchType: c.matchType,
    roleA: c.a.role,
    roleB: c.b.role,
    partyAName: c.a.companyName,
    partyBName: c.b.companyName,
    contextA: c.a.role === UserRole.founder ? compactFounderProfile(c.a.founderProfile) : compactInvestorProfile(c.a.investorProfile),
    contextB: c.b.role === UserRole.founder ? compactFounderProfile(c.b.founderProfile) : compactInvestorProfile(c.b.investorProfile),
    baseScore,
    hints,
  });
  return clampScore(scored.score);
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
function mandatoryFounderRoomPairs(ffCandidates) {
  if (ffCandidates.length < 1) return [];

  const founderIds = new Set();
  for (const c of ffCandidates) {
    founderIds.add(c.a.id);
    founderIds.add(c.b.id);
  }
  const unmatched = new Set(founderIds);
  const out = [];

  while (unmatched.size >= 2) {
    let pick = null;
    let bestScore = -1;
    for (const c of ffCandidates) {
      if (!unmatched.has(c.a.id) || !unmatched.has(c.b.id)) continue;
      if (c.score > bestScore) {
        bestScore = c.score;
        pick = c;
      }
    }
    if (!pick) break;
    unmatched.delete(pick.a.id);
    unmatched.delete(pick.b.id);
    out.push(pick);
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

  const ffPool = [];
  for (let i = 0; i < founders.length; i++) {
    for (let j = i + 1; j < founders.length; j++) {
      const x = founders[i];
      const y = founders[j];
      const [a, b] = orderPairUsers(x, y);
      ffPool.push({
        a,
        b,
        matchType: MatchType.founder_founder,
        score: 0,
        highlights: ["Reciprocal need/help fit", "Industry/ICP/GTM alignment", "Stage/revenue/raised compatibility"],
      });
    }
  }

  const scoredFfPool = await mapLimit(ffPool, SCORE_CONCURRENCY, async (c) => {
    const baseScore = scoreFounderFounderProfiles(c.a.founderProfile, c.b.founderProfile);
    const score = await llmScoreCandidate(c, baseScore, c.highlights);
    return { ...c, score };
  });

  const ffSelected = mandatoryFounderRoomPairs(scoredFfPool);
  const candidates = [...ffSelected];

  const fiPool = [];
  for (const f of founders) {
    for (const inv of investors) {
      const [a, b] = orderPairUsers(f, inv);
      fiPool.push({
        a,
        b,
        matchType: MatchType.founder_investor,
        score: 0,
        highlights: ["Needs/thesis fit", "Sector and stage alignment", "Traction and raised expectation fit"],
      });
    }
  }
  const scoredFi = await mapLimit(fiPool, SCORE_CONCURRENCY, async (candidate) => {
    const founder = candidate.a.role === UserRole.founder ? candidate.a : candidate.b;
    const investor = candidate.a.role === UserRole.investor ? candidate.a : candidate.b;
    const baseScore = founderInvestorScore(founder.founderProfile, investor.investorProfile);
    const score = await llmScoreCandidate(candidate, baseScore, candidate.highlights);
    return { ...candidate, score };
  });
  for (const c of scoredFi) {
    if (c.score >= MIN_SCORE) candidates.push(c);
  }

  const iiPool = [];
  for (let i = 0; i < investors.length; i++) {
    for (let j = i + 1; j < investors.length; j++) {
      const x = investors[i];
      const y = investors[j];
      const [a, b] = orderPairUsers(x, y);
      iiPool.push({
        a,
        b,
        matchType: MatchType.investor_investor,
        score: 0,
        highlights: ["Sector and stage overlap", "Co-investment thesis alignment"],
      });
    }
  }
  const scoredIi = await mapLimit(iiPool, SCORE_CONCURRENCY, async (candidate) => {
    const baseScore = investorInvestorScore(candidate.a.investorProfile, candidate.b.investorProfile);
    const score = await llmScoreCandidate(candidate, baseScore, candidate.highlights);
    return { ...candidate, score };
  });
  for (const c of scoredIi) {
    if (c.score >= MIN_SCORE) candidates.push(c);
  }

  let explanations;
  if (SKIP_AI_EXPLANATIONS) {
    explanations = candidates.map((c) => ({
      whyMatched: c.highlights,
      questions: DEFAULT_MATCH_QUESTIONS,
    }));
  } else {
    explanations = await mapLimit(candidates, EXPLANATIONS_CONCURRENCY, (c) =>
      buildMatchExplanation({
        roleA: c.a.role,
        roleB: c.b.role,
        score: c.score,
        highlights: c.highlights,
        matchType: c.matchType,
        partyAName: c.a.companyName,
        partyBName: c.b.companyName,
        contextA: c.a.role === UserRole.founder ? compactFounderProfile(c.a.founderProfile) : compactInvestorProfile(c.a.investorProfile),
        contextB: c.b.role === UserRole.founder ? compactFounderProfile(c.b.founderProfile) : compactInvestorProfile(c.b.investorProfile),
      }),
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
