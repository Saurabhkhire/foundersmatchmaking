import nodemailer from "nodemailer";
import { MatchType, UserRole } from "@prisma/client";
import { prisma } from "./prisma.js";
import { mapLimit } from "./concurrency.js";
import {
  scoreFounderFounderProfiles,
  scoreFounderInvestorProfiles,
  MIN_SCORE,
} from "./matching.js";
import {
  copyFounderFounderWhy,
  copyFounderFounderQuestions,
  copyFounderInvestorWhy,
  copyFounderInvestorQuestions,
  copyInvestorFounderWhy,
  copyInvestorFounderQuestions,
  mergeAiReasonPlain,
} from "./matchCopy.js";

const SMTP_SEND_CONCURRENCY = Math.max(1, Number(process.env.SMTP_SEND_CONCURRENCY || "6"));

function isFounderRole(role) {
  return role === UserRole.founder || role === "founder";
}

function isInvestorRole(role) {
  return role === UserRole.investor || role === "investor";
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Map counterpart userId -> Match row for this user */
function matchesByCounterpartId(matches, userId) {
  const map = new Map();
  for (const m of matches) {
    const otherId = m.userAId === userId ? m.userBId : m.userAId;
    map.set(otherId, m);
  }
  return map;
}

function renderQuestionList(qs) {
  const list = Array.isArray(qs) ? qs.map(String) : [];
  return `<ol style="margin:8px 0;padding-left:20px;">${list.map((q) => `<li style="margin:4px 0;">${escapeHtml(q)}</li>`).join("")}</ol>`;
}

function renderQuestionsHtml(qs) {
  const list = Array.isArray(qs) ? qs.map(String) : [];
  return `<ul style="margin:0;padding-left:18px;">${list.map((q) => `<li style="margin:4px 0;">${escapeHtml(q)}</li>`).join("")}</ul>`;
}

function htmlToPlainText(html) {
  return String(html)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|tr|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function renderLinkedInLine(linkedinUrl) {
  const url = String(linkedinUrl || "").trim();
  if (!url) return "";
  return `<br/><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;">LinkedIn</a>`;
}

function buildFounderEmailHtml(userName, roomPartner, founderRows, investorRows) {
  const roomHtml = roomPartner
    ? `<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin:16px 0;">
<h2 style="margin:0 0 8px;">Your 1v1 room partner (this round)</h2>
<p style="margin:0 0 8px;color:#334155;">Room assignment is mandatory for every founder when the cohort has an even headcount: each person gets exactly one dedicated peer partner for this round (pairs chosen by highest compatibility score among disjoint matches).</p>
<p style="margin:0;"><strong>${escapeHtml(roomPartner.companyName)}</strong> (${escapeHtml(roomPartner.username)})${renderLinkedInLine(roomPartner.linkedinUrl)} — <strong>${roomPartner.score}/100</strong></p>
<p style="margin:8px 0 0;"><em>Why connect:</em> ${escapeHtml(roomPartner.whyConnect)}</p>
<p style="margin:8px 0 0;"><strong>Suggested questions for each other</strong></p>
${renderQuestionList(Array.isArray(roomPartner.questions) ? roomPartner.questions : [])}
</div>`
    : `<div style="margin:16px 0;padding:12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;">
<h2 style="margin:0 0 8px;">Your 1v1 room partner</h2>
<p style="margin:0;">No room partner only happens when there is an <strong>odd</strong> number of founders (strict 1v1 cannot cover everyone). Add/remove one founder account or wait for the next cohort. Scores vs all founders are still listed below.</p>
</div>`;

  const foundersTable = `<h2 style="margin-top:24px;">All founders — scores, why connect, questions</h2>
<p style="color:#475569;">Every other founder in the pool, ranked by match score. Use this to choose peer conversations beyond your room partner.</p>
<table style="border-collapse:collapse;width:100%;margin-top:12px;font-size:14px;">
<thead><tr style="background:#f1f5f9;">
<th style="padding:10px;border:1px solid #e2e8f0;text-align:left;">Founder</th>
<th style="padding:10px;border:1px solid #e2e8f0;">Score</th>
<th style="padding:10px;border:1px solid #e2e8f0;text-align:left;">Why connect</th>
<th style="padding:10px;border:1px solid #e2e8f0;text-align:left;">3 questions to ask each other</th>
</tr></thead><tbody>
${founderRows
  .map(
    (r) => `<tr>
<td style="padding:10px;border:1px solid #e2e8f0;vertical-align:top;"><strong>${escapeHtml(r.companyName)}</strong><br/><span style="color:#64748b;">${escapeHtml(r.username)}</span>${renderLinkedInLine(r.linkedinUrl)}${r.isRoom ? '<br/><span style="font-size:12px;color:#0369a1;">Room partner</span>' : ""}</td>
<td style="padding:10px;border:1px solid #e2e8f0;vertical-align:top;text-align:center;"><strong>${r.score}</strong></td>
<td style="padding:10px;border:1px solid #e2e8f0;vertical-align:top;">${escapeHtml(r.whyConnect)}</td>
<td style="padding:10px;border:1px solid #e2e8f0;vertical-align:top;">${renderQuestionsHtml(r.questions)}</td>
</tr>`,
  )
  .join("")}
</tbody></table>`;

  const investorsTable = `<h2 style="margin-top:28px;">All investors — score, why them, questions</h2>
<table style="border-collapse:collapse;width:100%;margin-top:12px;font-size:14px;">
<thead><tr style="background:#f1f5f9;">
<th style="padding:10px;border:1px solid #e2e8f0;text-align:left;">Investor</th>
<th style="padding:10px;border:1px solid #e2e8f0;">Score</th>
<th style="padding:10px;border:1px solid #e2e8f0;text-align:left;">Why this investor / fit</th>
<th style="padding:10px;border:1px solid #e2e8f0;text-align:left;">Questions to explore</th>
</tr></thead><tbody>
${investorRows
  .map(
    (r) => `<tr>
<td style="padding:10px;border:1px solid #e2e8f0;vertical-align:top;"><strong>${escapeHtml(r.companyName)}</strong><br/><span style="color:#64748b;">${escapeHtml(r.username)}</span>${renderLinkedInLine(r.linkedinUrl)}</td>
<td style="padding:10px;border:1px solid #e2e8f0;vertical-align:top;text-align:center;"><strong>${r.score}</strong></td>
<td style="padding:10px;border:1px solid #e2e8f0;vertical-align:top;">${escapeHtml(r.whyFit)}</td>
<td style="padding:10px;border:1px solid #e2e8f0;vertical-align:top;">${renderQuestionsHtml(r.questions)}</td>
</tr>`,
  )
  .join("")}
</tbody></table>`;

  return `<div style="font-family:Georgia,serif;line-height:1.55;color:#0f172a;max-width:720px;">
<h1 style="font-family:Arial,sans-serif;">Founder Match — your results</h1>
<p>Hello ${escapeHtml(userName)},</p>
${roomHtml}
${foundersTable}
${investorsTable}
<p style="margin-top:28px;font-size:13px;color:#64748b;">Sent by Founder Match after the latest admin matching run.</p>
</div>`;
}

function buildInvestorEmailHtml(userName, founderRows) {
  if (!founderRows.length) {
    return `<div style="font-family:Georgia,serif;line-height:1.55;color:#0f172a;max-width:720px;">
<h1 style="font-family:Arial,sans-serif;">Founder Match — founders ranked for you</h1>
<p>Hello ${escapeHtml(userName)},</p>
<p>There are <strong>no founder profiles</strong> in the pool yet. Once founders register and matching runs again, this email will list everyone with personalized scores.</p>
</div>`;
  }
  const table = `<table style="border-collapse:collapse;width:100%;margin-top:12px;font-size:14px;">
<thead><tr style="background:#f1f5f9;">
<th style="padding:10px;border:1px solid #e2e8f0;text-align:left;">Founder / company</th>
<th style="padding:10px;border:1px solid #e2e8f0;">Score</th>
<th style="padding:10px;border:1px solid #e2e8f0;text-align:left;">Why invest / thesis fit</th>
<th style="padding:10px;border:1px solid #e2e8f0;text-align:left;">Diligence questions</th>
</tr></thead><tbody>
${founderRows
  .map(
    (r) => `<tr>
<td style="padding:10px;border:1px solid #e2e8f0;vertical-align:top;"><strong>${escapeHtml(r.companyName)}</strong><br/><span style="color:#64748b;">${escapeHtml(r.username)}</span>${renderLinkedInLine(r.linkedinUrl)}</td>
<td style="padding:10px;border:1px solid #e2e8f0;vertical-align:top;text-align:center;"><strong>${r.score}</strong></td>
<td style="padding:10px;border:1px solid #e2e8f0;vertical-align:top;">${escapeHtml(r.whyInvest)}</td>
<td style="padding:10px;border:1px solid #e2e8f0;vertical-align:top;">${renderQuestionsHtml(r.questions)}</td>
</tr>`,
  )
  .join("")}
</tbody></table>`;

  return `<div style="font-family:Georgia,serif;line-height:1.55;color:#0f172a;max-width:720px;">
<h1 style="font-family:Arial,sans-serif;">Founder Match — founders ranked for you</h1>
<p>Hello ${escapeHtml(userName)},</p>
<p>Below is <strong>every founder</strong> in the current pool with match score, rationale, and suggested diligence questions.</p>
${table}
<p style="margin-top:28px;font-size:13px;color:#64748b;">Sent by Founder Match after the latest admin matching run.</p>
</div>`;
}

async function buildHtmlForUser(u, allFounders, allInvestors) {
  const rawMatches = await prisma.match.findMany({
    where: { OR: [{ userAId: u.id }, { userBId: u.id }] },
  });
  const byOther = matchesByCounterpartId(rawMatches, u.id);

  if (isFounderRole(u.role) && u.founderProfile) {
    const myFp = u.founderProfile;
    const founderRows = [];

    for (const v of allFounders) {
      if (v.id === u.id) continue;
      const score = scoreFounderFounderProfiles(myFp, v.founderProfile);
      const m = byOther.get(v.id);
      const isRoom = m?.matchType === MatchType.founder_founder;
      const whyConnect = mergeAiReasonPlain(
        copyFounderFounderWhy(myFp, v.founderProfile, v.companyName, score),
        m?.matchType === MatchType.founder_founder ? m.aiReason : "",
      );
      const questions = copyFounderFounderQuestions(myFp, v.founderProfile, v.companyName);
      founderRows.push({
        companyName: v.companyName,
        username: v.username,
        linkedinUrl: v.founderProfile?.linkedinUrl || "",
        score,
        whyConnect,
        questions,
        isRoom: !!isRoom,
      });
    }
    founderRows.sort((a, b) => {
      if (a.isRoom !== b.isRoom) return a.isRoom ? -1 : 1;
      return b.score - a.score;
    });

    const rp = founderRows.find((r) => r.isRoom);
    const roomPartner = rp
      ? {
          companyName: rp.companyName,
          username: rp.username,
        linkedinUrl: rp.linkedinUrl,
          score: rp.score,
          whyConnect: rp.whyConnect,
          questions: rp.questions,
        }
      : null;

    const investorRows = [];
    for (const inv of allInvestors) {
      const score = scoreFounderInvestorProfiles(myFp, inv.investorProfile);
      const m = byOther.get(inv.id);
      const meets = score >= MIN_SCORE;
      const whyFit = mergeAiReasonPlain(
        copyFounderInvestorWhy(myFp, inv.investorProfile, inv.companyName, score, meets),
        m?.matchType === MatchType.founder_investor ? m.aiReason : "",
      );
      const questions = copyFounderInvestorQuestions(myFp, inv.investorProfile, inv.companyName);
      investorRows.push({
        companyName: inv.companyName,
        username: inv.username,
        linkedinUrl: inv.investorProfile?.linkedinUrl || "",
        score,
        whyFit,
        questions,
      });
    }
    investorRows.sort((a, b) => b.score - a.score);

    return {
      html: buildFounderEmailHtml(u.companyName, roomPartner, founderRows, investorRows),
      subject: "Founder Match — room partner, all founders & investors",
    };
  }

  if (isInvestorRole(u.role) && u.investorProfile) {
    const invProf = u.investorProfile;
    const founderRows = [];

    for (const f of allFounders) {
      if (!f.founderProfile) continue;
      const score = scoreFounderInvestorProfiles(f.founderProfile, invProf);
      const m = byOther.get(f.id);
      const meets = score >= MIN_SCORE;
      const whyInvest = mergeAiReasonPlain(
        copyInvestorFounderWhy(invProf, f.founderProfile, f.companyName, score, meets),
        m?.matchType === MatchType.founder_investor ? m.aiReason : "",
      );
      const questions = copyInvestorFounderQuestions(invProf, f.founderProfile, f.companyName);
      founderRows.push({
        companyName: f.companyName,
        username: f.username,
        linkedinUrl: f.founderProfile?.linkedinUrl || "",
        score,
        whyInvest,
        questions,
      });
    }
    founderRows.sort((a, b) => b.score - a.score);

    console.log(`[email] investor digest for ${u.email}: ${founderRows.length} founders`);

    return {
      html: buildInvestorEmailHtml(u.companyName, founderRows),
      subject: "Founder Match — all founders ranked for your thesis",
    };
  }

  return null;
}

export async function sendMatchEmailsToAllUsers() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass || !from) {
    return {
      sent: 0,
      failed: 0,
      skipped: true,
      reason: "Missing SMTP configuration (need SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM)",
    };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  try {
    await transporter.verify();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] SMTP verify failed:", message);
    return {
      sent: 0,
      failed: 0,
      skipped: true,
      reason: `SMTP verify failed — check host, port, TLS, and credentials: ${message}`,
    };
  }

  const [recipients, allFounders, allInvestors] = await Promise.all([
    prisma.user.findMany({
      where: { role: { not: UserRole.admin } },
      select: {
        id: true,
        companyName: true,
        email: true,
        role: true,
        founderProfile: true,
        investorProfile: true,
      },
    }),
    prisma.user.findMany({
      where: { role: UserRole.founder },
      select: { id: true, companyName: true, username: true, founderProfile: true },
    }),
    prisma.user.findMany({
      where: { role: UserRole.investor },
      select: { id: true, companyName: true, username: true, investorProfile: true },
    }),
  ]);

  async function sendOne(u) {
    const built = await buildHtmlForUser(u, allFounders, allInvestors);
    if (!built) {
      console.warn(`[email] skip user ${u.id} — unsupported role or missing profile`);
      return "skipped";
    }
    try {
      await transporter.sendMail({
        from,
        to: u.email,
        replyTo: from,
        subject: built.subject,
        html: built.html,
        text: htmlToPlainText(built.html),
      });
      return "sent";
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[email] send failed for ${u.email}:`, message);
      return "failed";
    }
  }

  const outcomes = await mapLimit(recipients, SMTP_SEND_CONCURRENCY, sendOne);
  const sent = outcomes.filter((o) => o === "sent").length;
  const failed = outcomes.filter((o) => o === "failed").length;
  const skippedRecipients = outcomes.filter((o) => o === "skipped").length;

  return {
    sent,
    failed,
    skipped: false,
    skippedRecipients,
    smtpVerified: true,
  };
}
