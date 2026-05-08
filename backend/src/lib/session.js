import { verifyToken } from "./auth.js";

export function getSession(req) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}

export function requireAuth(req, res, next) {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  req.session = session;
  next();
}

export function requireAdmin(req, res, next) {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  req.session = session;
  next();
}
