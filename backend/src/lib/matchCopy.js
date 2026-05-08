/**
 * Personalized “why” blurbs and question lists from actual profile fields (not generic templates).
 */
import { DEFAULT_MATCH_QUESTIONS } from "./matching.js";

function clip(s, max = 160) {
  const t = String(s ?? "").trim();
  if (!t) return "";
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function pick(...parts) {
  return parts.find((p) => String(p ?? "").trim().length > 0) || "";
}

/** Founder ↔ founder: emphasize lookingFor (field 5) and canHelp (field 6). */
export function copyFounderFounderWhy(viewerFp, otherFp, otherCompany, score) {
  const lfV = clip(viewerFp.lookingFor, 120);
  const chV = clip(viewerFp.canHelp, 120);
  const lfO = clip(otherFp.lookingFor, 120);
  const chO = clip(otherFp.canHelp, 120);
  const icp = clip(viewerFp.icp, 80);
  const icpO = clip(otherFp.icp, 80);
  const bot = clip(viewerFp.biggestBottleneck, 100);
  const botO = clip(otherFp.biggestBottleneck, 100);

  const sentences = [];

  if (lfV && chO) {
    sentences.push(
      `You’re asking for “${lfV}” while ${otherCompany} signals they can help with “${chO}” — that’s the core peer fit we weighted highest.`,
    );
  } else if (chO && lfV) {
    sentences.push(`${otherCompany}’s “can help with” line complements what you said you’re looking for.`);
  }

  if (lfO && chV) {
    sentences.push(
      `They need “${lfO}” and you listed “${chV}” as what you can offer — reciprocal support potential.`,
    );
  }

  if (icp && icpO && (icp === icpO || icp.includes(icpO) || icpO.includes(icp))) {
    sentences.push(`Both of you point at similar customer contexts (${clip(icp, 60)} / ${clip(icpO, 60)}).`);
  } else if (icp && icpO) {
    sentences.push(`ICP overlap: you (“${clip(icp, 70)}”) vs them (“${clip(icpO, 70)}”).`);
  }

  if (bot && chO) {
    sentences.push(`Your bottleneck (“${clip(bot, 90)}”) may benefit from their stated strengths (“${clip(chO, 90)}”).`);
  } else if (botO && chV) {
    sentences.push(`Their bottleneck (“${clip(botO, 90)}”) may map to what you can bring (“${clip(chV, 90)}”).`);
  }

  sentences.push(`Match score ${score}/100 (algorithm prioritizes “Looking for” ↔ “Can help” fit, then ICP/GTM and stage).`);

  return sentences.filter(Boolean).join(" ");
}

export function copyFounderFounderQuestions(viewerFp, otherFp, otherLabel) {
  const lfV = clip(viewerFp.lookingFor, 100);
  const chV = clip(viewerFp.canHelp, 100);
  const lfO = clip(otherFp.lookingFor, 100);
  const chO = clip(otherFp.canHelp, 100);
  const q = [];

  if (lfV && chO) {
    q.push(
      `Given you’re looking for “${lfV}”, what can ${otherLabel} concretely commit from their “${chO}” experience in the next 30 days?`,
    );
  }
  if (lfO && chV) {
    q.push(
      `They need “${lfO}” — where does your “${chV}” map to a quick win (intro, review, or pilot design)?`,
    );
  }
  if (viewerFp.biggestBottleneck && chO) {
    q.push(
      `Your bottleneck is “${clip(viewerFp.biggestBottleneck, 90)}” — what would ${otherLabel} try first using “${clip(chO, 70)}”?`,
    );
  }
  if (q.length < 3 && lfO) {
    q.push(`What proof or artifact would convince you their path fits “${lfO}”?`);
  }
  const icpL = icpLine(viewerFp, otherFp);
  if (q.length < 3 && icpL) {
    q.push(`How do you each define “good” customer for ${icpL} — same playbook or different wedge?`);
  }

  let i = 0;
  while (q.length < 3 && i < DEFAULT_MATCH_QUESTIONS.length) {
    q.push(DEFAULT_MATCH_QUESTIONS[i]);
    i += 1;
  }
  return q.slice(0, 3);
}

function icpLine(a, b) {
  const x = clip(a.icp, 40);
  const y = clip(b.icp, 40);
  if (x && y) return `"${x}" vs "${y}"`;
  return pick(x, y, "your markets");
}

/** Founder viewing investor row */
export function copyFounderInvestorWhy(founderFp, invIp, investorCompany, score, meetsThreshold) {
  const lf = clip(founderFp.lookingFor, 120);
  const ch = clip(founderFp.canHelp, 100);
  const sector = clip(invIp.preferredSector, 100);
  const stage = clip(invIp.preferredStage, 80);
  const traction = clip(invIp.tractionExpectation, 100);
  const interest = clip(invIp.investmentInterest, 120);
  const pref = clip(invIp.usersPreference, 120);
  const one = clip(founderFp.startupOneLiner, 120);

  const s = [];
  s.push(
    `Weighted heavily on your “Looking for” / “Can help” vs this investor’s thesis and founder preference (score ${score}/100${meetsThreshold ? "" : " — below usual intro threshold"}).`,
  );

  if (lf && (interest || pref)) {
    s.push(`You’re seeking “${clip(lf, 100)}” — ${investorCompany} focuses on “${clip(interest || pref, 130)}”.`);
  }
  if (ch && interest) {
    s.push(`You offer “${ch}” — worth mapping to themes they back (“${clip(interest, 100)}”).`);
  }
  if (one && interest) {
    s.push(`Your one-liner (“${clip(one, 110)}”) vs their mandate (“${clip(interest, 110)}”).`);
  }
  if (sector || stage || traction) {
    s.push(`Their bar: sector “${clip(sector, 90)}”, stage “${clip(stage, 70)}”, traction “${clip(traction, 100)}”.`);
  }
  if (pref) {
    s.push(`They gravitate toward founders who: “${clip(pref, 130)}”.`);
  }

  return s.join(" ");
}

export function copyFounderInvestorQuestions(founderFp, invIp, investorLabel) {
  const lf = clip(founderFp.lookingFor, 90);
  const ch = clip(founderFp.canHelp, 80);
  const interest = clip(invIp.investmentInterest, 100);
  const pref = clip(invIp.usersPreference, 100);
  const traction = clip(invIp.tractionExpectation, 100);
  const q = [];

  if (lf && interest) {
    q.push(
      `You said you need “${lf}” — how does ${investorLabel}’s portfolio or thesis (“${clip(interest, 90)}”) accelerate that?`,
    );
  }
  if (traction && founderFp.revenue) {
    q.push(
      `Against their traction bar (“${clip(traction, 100)}”), where does your revenue story (“${clip(founderFp.revenue, 80)}”) land?`,
    );
  }
  if (pref && ch) {
    q.push(`They prefer “${clip(pref, 100)}” — show how your “can help” (“${clip(ch, 80)}”) reflects that operating style.`);
  }
  let i = 0;
  while (q.length < 3 && i < DEFAULT_MATCH_QUESTIONS.length) {
    q.push(DEFAULT_MATCH_QUESTIONS[i]);
    i += 1;
  }
  return q.slice(0, 3);
}

/** Investor viewing founder row (“why invest”) */
export function copyInvestorFounderWhy(invIp, founderFp, founderCompany, score, meetsThreshold) {
  const interest = clip(invIp.investmentInterest, 120);
  const pref = clip(invIp.usersPreference, 120);
  const sector = clip(invIp.preferredSector, 100);
  const lf = clip(founderFp.lookingFor, 120);
  const ch = clip(founderFp.canHelp, 100);
  const one = clip(founderFp.startupOneLiner, 130);
  const icp = clip(founderFp.icp, 100);
  const bot = clip(founderFp.biggestBottleneck, 120);

  const s = [];
  s.push(
    `Score ${score}/100 — prioritized fit between your mandate (“${clip(interest || sector, 130)}”) and their stated needs/offers (“Looking for” / “Can help”).`,
  );

  if (!meetsThreshold) {
    s.push(`Below usual intro threshold; still useful if thesis sparks optional diligence.`);
  }

  if (one && interest) {
    s.push(`${founderCompany}: “${one}” vs your interest in “${clip(interest, 120)}”.`);
  }
  if (lf && pref) {
    s.push(`They want “${clip(lf, 110)}” — check vs your founder preference (“${clip(pref, 110)}”).`);
  }
  if (ch && interest) {
    s.push(`They can contribute “${clip(ch, 100)}” relevant to how you deploy (“${clip(interest, 100)}”).`);
  }
  if (icp && sector) {
    s.push(`ICP “${clip(icp, 100)}” vs your sectors “${clip(sector, 100)}”.`);
  }
  if (bot) {
    s.push(`Their bottleneck: “${clip(bot, 130)}” — map to your value-add or pass quickly.`);
  }

  return s.join(" ");
}

export function copyInvestorFounderQuestions(invIp, founderFp, founderLabel) {
  const interest = clip(invIp.investmentInterest, 100);
  const traction = clip(invIp.tractionExpectation, 100);
  const pref = clip(invIp.usersPreference, 90);
  const one = clip(founderFp.startupOneLiner, 90);
  const lf = clip(founderFp.lookingFor, 90);
  const q = [];

  if (one && interest) {
    q.push(
      `For “${clip(one, 80)}”, what milestone proves alignment with what you back (“${clip(interest, 90)}”)?`,
    );
  }
  if (traction && founderFp.revenue) {
    q.push(
      `Against “${clip(traction, 100)}”, defend traction using their numbers (“${clip(founderFp.revenue, 70)}” revenue story).`,
    );
  }
  if (lf && pref) {
    q.push(`They’re seeking “${clip(lf, 90)}” — does that match how you like to work (“${clip(pref, 90)}”)?`);
  }
  let i = 0;
  while (q.length < 3 && i < DEFAULT_MATCH_QUESTIONS.length) {
    q.push(DEFAULT_MATCH_QUESTIONS[i]);
    i += 1;
  }
  return q.slice(0, 3);
}

/** Append stored AI rationale when non-redundant (plain text). */
export function mergeAiReasonPlain(personalizedParagraph, aiReason) {
  const ai = String(aiReason ?? "").trim();
  if (!ai) return personalizedParagraph;
  if (personalizedParagraph.includes(ai.slice(0, Math.min(48, ai.length)))) return personalizedParagraph;
  return `${personalizedParagraph} Additional signal: ${ai}`;
}
