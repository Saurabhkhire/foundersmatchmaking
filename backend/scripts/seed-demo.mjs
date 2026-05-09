/**
 * Loads 20 demo founders + 5 demo investors (password: demo123456).
 * Profile text is aligned with matching rules (substring overlap ≥ MIN_SCORE).
 * Removes previous demo_* users first so the script is idempotent.
 *
 * Usage (from repo root):
 *   cd backend && npm run seed:demo
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "demo123456";
/** Base inbox; each demo user uses Gmail plus-addressing (unique in DB, same inbox). */
const DEMO_EMAIL_BASE = "saurabhskhire@gmail.com";
const [demoLocal, demoDomain] = DEMO_EMAIL_BASE.split("@");

function demoEmail(tag) {
  return `${demoLocal}+${tag}@${demoDomain}`;
}

/**
 * Each lane: one investor + 4 founders share phrases so overlapScore() clears the ~65 threshold.
 * redFlags must NOT appear as a substring in startupOneLiner (see founderInvestorScore).
 */
const LANES = [
  {
    investor: {
      preferredSector:
        "B2B SaaS DevTools Security — platform engineering RevOps infrastructure buyers",
      preferredStage: "pre-seed and seed and Series A stage companies",
      tractionExpectation: "10k+ MRR or design partners on a path to 10k+ MRR with usage proof",
      investmentInterest: "developer tools API infrastructure PLG and GTM software for engineering-led teams",
      redFlags: "zz-redflag-lane1-do-not-repeat-in-pitch",
      usersPreference: "technical founders who ship weekly and care about onboarding metrics",
    },
    founders: [
      { tag: "Atlas", focus: "CI/CD analytics for platform teams" },
      { tag: "Beacon", focus: "internal developer portals and service catalogs" },
      { tag: "Cedar", focus: "API monetization and usage billing" },
      { tag: "Drift", focus: "security reviews in the SDLC" },
    ],
  },
  {
    investor: {
      preferredSector: "Fintech Insurtech payments risk compliance and regulated workflows",
      preferredStage: "seed to Series B with regulatory clarity",
      tractionExpectation: "bank pilot or 10k+ MRR with clear underwriting story",
      investmentInterest: "payments infrastructure compliance automation and risk scoring for finance teams",
      redFlags: "zz-redflag-lane2-do-not-repeat-in-pitch",
      usersPreference: "operator-led teams with compliance-first roadmap",
    },
    founders: [
      { tag: "Elm", focus: "SMB treasury and cash visibility" },
      { tag: "Fern", focus: "embedded payments for vertical SaaS" },
      { tag: "Grove", focus: "broker commission automation" },
      { tag: "Haven", focus: "fraud signals for lending workflows" },
    ],
  },
  {
    investor: {
      preferredSector: "Climate industrials energy efficiency hardware pilots and LOI-backed deployments",
      preferredStage: "pre-seed through Series A",
      tractionExpectation: "pilots with LOIs or measurable CO2 or energy savings",
      investmentInterest: "decarbonization industrial IoT energy materials and carbon accounting software",
      redFlags: "zz-redflag-lane3-do-not-repeat-in-pitch",
      usersPreference: "deep domain experts comfortable selling long cycles",
    },
    founders: [
      { tag: "Iris", focus: "factory energy monitoring" },
      { tag: "Juniper", focus: "fleet electrification planning" },
      { tag: "Kelp", focus: "building HVAC optimization" },
      { tag: "Lumen", focus: "supplier emissions data network" },
    ],
  },
  {
    investor: {
      preferredSector: "Consumer subscription media community creator economy mobile growth",
      preferredStage: "pre-seed with repeatable acquisition",
      tractionExpectation: "strong organic growth retention cohorts or creator-led distribution proof",
      investmentInterest: "subscription community creator tools and growth loops for consumer apps",
      redFlags: "zz-redflag-lane4-do-not-repeat-in-pitch",
      usersPreference: "founder-led distribution and crisp retention narrative",
    },
    founders: [
      { tag: "Mesa", focus: "paid communities for hobbyists" },
      { tag: "Nova", focus: "short-form UGC brand campaigns" },
      { tag: "Olive", focus: "newsletter and membership bundles" },
      { tag: "Pike", focus: "mobile games UA and live-ops tools" },
    ],
  },
  {
    investor: {
      preferredSector: "Health Bio clinical workflows diagnostics provider software HIPAA-aware tools",
      preferredStage: "seed and beyond with clinical or provider traction",
      tractionExpectation: "clinical workflow adoption or provider pilots with outcomes data",
      investmentInterest: "workflow software diagnostics enablement and clinician-friendly UX",
      redFlags: "zz-redflag-lane5-do-not-repeat-in-pitch",
      usersPreference: "MD-advised teams who respect clinical reality",
    },
    founders: [
      { tag: "Quill", focus: "clinic scheduling and prior auth prep" },
      { tag: "Reef", focus: "ambient documentation assist" },
      { tag: "Sable", focus: "patient triage and routing" },
      { tag: "Tarn", focus: "lab results routing for PCPs" },
    ],
  },
];

function founderProfileFromLane(lane, variant, indexGlobal) {
  const inv = lane.investor;
  const { tag, focus } = variant;
  // Exact phrase overlap with investor fields (max points on icp/stage/revenue).
  const icp = inv.preferredSector;
  const stage = inv.preferredStage;
  const revenue = inv.tractionExpectation;
  const industryType = inv.preferredSector.split(" ")[0] || "Other";
  const moneyRaised = indexGlobal % 2 === 0 ? "500k to 1m" : "1m to 5m";
  // GTM must be a substring of the one-liner for the startupOneLiner vs gtm overlap term.
  const gtm = inv.investmentInterest.slice(0, Math.min(inv.investmentInterest.length, 72));
  const startupOneLiner = `${tag} — ${focus}; we sell ${inv.investmentInterest} aligned with ${inv.preferredSector.slice(0, 48)}.`;
  const biggestBottleneck = indexGlobal % 2 === 0 ? "Expanding enterprise pipeline without slowing ship cadence" : "Turning pilots into repeatable revenue";
  const lookingFor = inv.usersPreference;
  const canHelp = indexGlobal % 2 === 0 ? "PLG experiments and onboarding teardowns" : "Partner intros and solution design reviews";
  const teamSize = 3 + (indexGlobal % 5);
  const usersCount = 200 + indexGlobal * 150;
  const pitch = [
    `Three-minute story for ${tag}: we focus on ${focus}.`,
    `We serve ${icp.slice(0, 80)}… with motion ${gtm.slice(0, 60)}…`,
    `Stage: ${stage.split(" ").slice(0, 6).join(" ")}; traction target: ${revenue.slice(0, 70)}…`,
    `Asking for partners who fit: ${lookingFor}. Happy to help peers with: ${canHelp}.`,
  ].join(" ");
  return {
    linkedinUrl: `https://www.linkedin.com/in/demo-founder-${tag.toLowerCase()}`,
    startupOneLiner,
    industryType,
    icp,
    gtm,
    biggestBottleneck,
    lookingFor,
    canHelp,
    stage,
    revenue,
    moneyRaised,
    teamSize,
    usersCount,
    pitch,
  };
}

function investorPitchFromLane(lane) {
  const inv = lane.investor;
  return [
    `Thesis: ${inv.preferredSector.slice(0, 120)}…`,
    `Stages: ${inv.preferredStage}. Traction bar: ${inv.tractionExpectation.slice(0, 100)}…`,
    `Themes: ${inv.investmentInterest}. Partner fit: ${inv.usersPreference}.`,
  ].join(" ");
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const deleted = await prisma.user.deleteMany({
    where: {
      OR: [
        { username: { startsWith: "demo_founder_" } },
        { username: { startsWith: "demo_investor_" } },
      ],
    },
  });
  if (deleted.count) {
    console.log(`Removed ${deleted.count} previous demo users.`);
  }

  let founderIndex = 0;
  for (let laneIdx = 0; laneIdx < LANES.length; laneIdx++) {
    const lane = LANES[laneIdx];
    for (const variant of lane.founders) {
      founderIndex += 1;
      const n = String(founderIndex).padStart(2, "0");
      const data = founderProfileFromLane(lane, variant, founderIndex - 1);
      await prisma.user.create({
        data: {
          companyName: `Demo Founder Co ${n} (${variant.tag})`,
          email: demoEmail(`demo_founder_${n}`),
          username: `demo_founder_${n}`,
          passwordHash,
          role: "founder",
          founderProfile: {
            create: data,
          },
        },
      });
    }
  }

  for (let i = 0; i < LANES.length; i++) {
    const lane = LANES[i];
    const inv = lane.investor;
    const n = String(i + 1).padStart(2, "0");
    await prisma.user.create({
      data: {
        companyName: `Demo Capital ${n}`,
        email: demoEmail(`demo_investor_${n}`),
        username: `demo_investor_${n}`,
        passwordHash,
        role: "investor",
        investorProfile: {
          create: {
            linkedinUrl: `https://www.linkedin.com/in/demo-investor-${n}`,
            preferredSector: inv.preferredSector,
            preferredStage: inv.preferredStage,
            tractionExpectation: inv.tractionExpectation,
            investmentInterest: inv.investmentInterest,
            redFlags: inv.redFlags,
            usersPreference: inv.usersPreference,
            pitch: investorPitchFromLane(lane),
          },
        },
      },
    });
  }

  console.log("Demo data loaded (profiles tuned for match scores ≥ threshold):");
  console.log("  20 founders: demo_founder_01 … demo_founder_20");
  console.log("  5 investors: demo_investor_01 … demo_investor_05");
  console.log(`  Emails: ${demoLocal}+demo_*@${demoDomain} → inbox ${DEMO_EMAIL_BASE}`);
  console.log(`  Password (all): ${DEMO_PASSWORD}`);
  console.log("");
  console.log("Match emails: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM in backend/.env.");
  console.log("If SMTP is unset, run-matching still writes matches but skips sending mail.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
