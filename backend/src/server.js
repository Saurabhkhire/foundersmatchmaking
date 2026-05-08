import "dotenv/config";
import express from "express";
import cors from "cors";
import { apiRouter } from "./routes/api.js";

const app = express();
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

app.use(cors({ origin: frontendUrl }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "founder-match-backend" });
});

app.use("/api", apiRouter);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
