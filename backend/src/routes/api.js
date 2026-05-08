import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hashPassword, signToken, verifyPassword } from "../lib/auth.js";
import { requireAdmin, requireAuth } from "../lib/session.js";
import { runMatching } from "../lib/matching.js";
import { sendMatchEmailsToAllUsers } from "../lib/email.js";
import { generateThreeMinutePitch } from "../lib/openai.js";

export const apiRouter = Router();

const registerSchema = z.object({
  companyName: z.string().min(1),
  email: z.string().email(),
  username: z.string().min(3),
  password: z.string().min(6),
  role: z.enum(["founder", "investor", "admin"]),
});

const loginSchema = z.object({ username: z.string().min(1), password: z.string().min(1) });

apiRouter.post("/auth/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const [byUsername, byEmail] = await Promise.all([
    prisma.user.findUnique({ where: { username: parsed.data.username } }),
    prisma.user.findUnique({ where: { email: parsed.data.email } }),
  ]);

  if (byUsername) return res.status(409).json({ error: "Username already in use" });
  if (byEmail) return res.status(409).json({ error: "Email already in use" });

  const user = await prisma.user.create({
    data: {
      companyName: parsed.data.companyName,
      email: parsed.data.email,
      username: parsed.data.username,
      passwordHash: await hashPassword(parsed.data.password),
      role: parsed.data.role,
      founderProfile: parsed.data.role === "founder" ? { create: { startupOneLiner: "", icp: "", gtm: "", biggestBottleneck: "", lookingFor: "", canHelp: "", stage: "idea", revenue: "pre-revenue", teamSize: 1, usersCount: 0 } } : undefined,
      investorProfile: parsed.data.role === "investor" ? { create: { preferredSector: "", preferredStage: "", tractionExpectation: "", investmentInterest: "", redFlags: "", usersPreference: "" } } : undefined,
    },
  });

  const token = signToken({ userId: user.id, role: user.role, username: user.username });
  res.json({ ok: true, token, user: { id: user.id, username: user.username, role: user.role } });
});

apiRouter.post("/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const user = await prisma.user.findUnique({ where: { username: parsed.data.username } });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken({ userId: user.id, role: user.role, username: user.username });
  res.json({ ok: true, token, user: { id: user.id, username: user.username, role: user.role } });
});

apiRouter.get("/auth/me", requireAuth, async (req, res) => {
  res.json({ user: req.session });
});

apiRouter.get("/profile", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.session.userId }, include: { founderProfile: true, investorProfile: true } });
  res.json({ user });
});

apiRouter.put("/profile", requireAuth, async (req, res) => {
  const body = req.body || {};
  if (req.session.role === "founder") {
    await prisma.founderProfile.update({ where: { userId: req.session.userId }, data: { startupOneLiner: body.startupOneLiner ?? "", icp: body.icp ?? "", gtm: body.gtm ?? "", biggestBottleneck: body.biggestBottleneck ?? "", lookingFor: body.lookingFor ?? "", canHelp: body.canHelp ?? "", stage: body.stage ?? "", revenue: body.revenue ?? "", teamSize: Number(body.teamSize || 0), usersCount: Number(body.usersCount || 0), pitch: body.pitch ?? "" } });
  } else if (req.session.role === "investor") {
    await prisma.investorProfile.update({ where: { userId: req.session.userId }, data: { preferredSector: body.preferredSector ?? "", preferredStage: body.preferredStage ?? "", tractionExpectation: body.tractionExpectation ?? "", investmentInterest: body.investmentInterest ?? "", redFlags: body.redFlags ?? "", usersPreference: body.usersPreference ?? "", pitch: body.pitch ?? "" } });
  }
  res.json({ ok: true });
});

apiRouter.post("/profile/generate-pitch", requireAuth, async (req, res) => {
  const pitch = await generateThreeMinutePitch(req.session.role, req.body || {});
  res.json({ pitch });
});

apiRouter.get("/matches", requireAuth, async (req, res) => {
  const raw = await prisma.match.findMany({
    where: { OR: [{ userAId: req.session.userId }, { userBId: req.session.userId }] },
    orderBy: { score: "desc" },
    include: {
      userA: { select: { id: true, username: true, companyName: true, role: true } },
      userB: { select: { id: true, username: true, companyName: true, role: true } },
    },
  });

  const withCounterpart = raw.map((m) => ({ ...m, counterpart: m.userAId === req.session.userId ? m.userB : m.userA, aiQuestions: m.aiQuestions }));
  const founderMatches = withCounterpart.filter((m) => m.counterpart.role === "founder");
  const investorMatches = withCounterpart.filter((m) => m.counterpart.role === "investor");

  res.json({
    bestFounderMatch: founderMatches[0] ?? null,
    bestInvestorMatch: investorMatches[0] ?? null,
    founderMatches,
    investorMatches,
  });
});

apiRouter.get("/admin/users", requireAdmin, async (_req, res) => {
  const users = await prisma.user.findMany({ select: { id: true, username: true, companyName: true, role: true, createdAt: true }, orderBy: { createdAt: "desc" } });
  res.json({ users });
});

apiRouter.delete("/admin/users/:id", requireAdmin, async (req, res) => {
  await prisma.user.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

apiRouter.delete("/admin/users", requireAdmin, async (_req, res) => {
  const result = await prisma.user.deleteMany({
    where: { role: { not: "admin" } },
  });
  res.json({ ok: true, deletedCount: result.count });
});

apiRouter.post("/admin/run-matching", requireAdmin, async (_req, res) => {
  await runMatching();
  const email = await sendMatchEmailsToAllUsers();
  res.json({ ok: true, email });
});
