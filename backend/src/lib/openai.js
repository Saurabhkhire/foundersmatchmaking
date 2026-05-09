import OpenAI from "openai";

const ZERO_EMBEDDING = Array.from({ length: 1536 }, () => 0);

function getClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function extractFounderMetadata(input) {
  const fallback = { industry: "", buyerType: "", gtmMotion: "", strengths: [], needs: [], stage: "", marketType: "", businessModel: "" };
  const client = getClient();
  if (!client) return fallback;
  const prompt = "Return strict JSON only with keys industry,buyerType,gtmMotion,strengths:string[],needs:string[],stage,marketType,businessModel. Input: " + input;
  const response = await client.responses.create({ model: "gpt-4.1-mini", input: prompt });
  try { return JSON.parse(response.output_text || "{}"); } catch { return fallback; }
}

export async function extractInvestorMetadata(input) {
  const fallback = { sectors: [], preferredStages: [], thesis: [], avoid: [], checkSizeEstimate: "" };
  const client = getClient();
  if (!client) return fallback;
  const prompt = "Return strict JSON only with keys sectors:string[],preferredStages:string[],thesis:string[],avoid:string[],checkSizeEstimate. Input: " + input;
  const response = await client.responses.create({ model: "gpt-4.1-mini", input: prompt });
  try { return JSON.parse(response.output_text || "{}"); } catch { return fallback; }
}

export async function embeddingFromText(text) {
  const client = getClient();
  if (!client) return ZERO_EMBEDDING;
  const res = await client.embeddings.create({ model: "text-embedding-3-small", input: text });
  return res.data[0]?.embedding ?? ZERO_EMBEDDING;
}

export async function buildMatchExplanation(input) {
  const client = getClient();
  if (!client) {
    return {
      whyMatched: input.highlights,
      questions: [
        "What tactical outcome do you want from this conversation?",
        "What bottleneck can each of you help solve quickly?",
        "What next step can you commit to in one week?",
      ],
    };
  }
  const contextA = JSON.stringify(input.contextA || {});
  const contextB = JSON.stringify(input.contextB || {});
  const prompt =
    "Return strict JSON only with keys whyMatched:string[] and questions:string[] (exactly 3). " +
    "Questions must be concrete and tailored to the two profiles; avoid generic networking prompts. " +
    "whyMatched must explain specific overlaps, complementary needs/help, and key tensions.\n" +
    "roleA=" + input.roleA +
    "; roleB=" + input.roleB +
    "; score=" + input.score +
    "; matchType=" + (input.matchType || "") +
    "; partyAName=" + (input.partyAName || "party A") +
    "; partyBName=" + (input.partyBName || "party B") +
    "; highlights=" + input.highlights.join("; ") +
    "\nA_PROFILE=" + contextA +
    "\nB_PROFILE=" + contextB;
  const response = await client.responses.create({ model: "gpt-4.1-mini", input: prompt });
  try { return JSON.parse(response.output_text || "{}"); } catch { return { whyMatched: input.highlights, questions: [] }; }
}

export async function buildMatchScore(input) {
  const client = getClient();
  if (!client) return { score: Number(input.baseScore || 0) };

  const contextA = JSON.stringify(input.contextA || {});
  const contextB = JSON.stringify(input.contextB || {});
  const prompt =
    "Return strict JSON only with keys score:number and rationale:string[]. " +
    "Score must be integer 0..100. Use both profiles and compare needs, offerings, stage, traction and thesis fit. " +
    "Do not be generic.\n" +
    "matchType=" + (input.matchType || "") +
    "; roleA=" + input.roleA +
    "; roleB=" + input.roleB +
    "; partyAName=" + (input.partyAName || "party A") +
    "; partyBName=" + (input.partyBName || "party B") +
    "; baseScore=" + Number(input.baseScore || 0) +
    "; hints=" + (Array.isArray(input.hints) ? input.hints.join("; ") : "") +
    "\nA_PROFILE=" + contextA +
    "\nB_PROFILE=" + contextB;

  const response = await client.responses.create({ model: "gpt-4.1-mini", input: prompt });
  try {
    const parsed = JSON.parse(response.output_text || "{}");
    const n = Number(parsed.score);
    if (!Number.isFinite(n)) return { score: Number(input.baseScore || 0) };
    return { score: Math.max(0, Math.min(100, Math.round(n))), rationale: parsed.rationale || [] };
  } catch {
    return { score: Number(input.baseScore || 0) };
  }
}

function founderPitchContext(p) {
  const x = p || {};
  return [
    `Startup one-liner: ${x.startupOneLiner ?? ""}`,
    `Industry type: ${x.industryType ?? ""}`,
    `ICP (ideal customer): ${x.icp ?? ""}`,
    `GTM (go-to-market): ${x.gtm ?? ""}`,
    `Biggest bottleneck: ${x.biggestBottleneck ?? ""}`,
    `Looking for: ${x.lookingFor ?? ""}`,
    `Can help with: ${x.canHelp ?? ""}`,
    `Stage: ${x.stage ?? ""}`,
    `Revenue: ${x.revenue ?? ""}`,
    `Money raised: ${x.moneyRaised ?? ""}`,
    `Team size: ${x.teamSize ?? ""}`,
    `Users count: ${x.usersCount ?? ""}`,
  ].join("\n");
}

function investorPitchContext(p) {
  const x = p || {};
  return [
    `Preferred sector: ${x.preferredSector ?? ""}`,
    `Preferred stage: ${x.preferredStage ?? ""}`,
    `Traction expectation: ${x.tractionExpectation ?? ""}`,
    `Investment interest: ${x.investmentInterest ?? ""}`,
    `Red flags: ${x.redFlags ?? ""}`,
    `Users preference: ${x.usersPreference ?? ""}`,
  ].join("\n");
}

export async function generateThreeMinutePitch(role, profile) {
  const client = getClient();
  const structured =
    role === "founder" || role === "admin"
      ? founderPitchContext(profile)
      : investorPitchContext(profile);
  const profileJson = JSON.stringify(profile || {});

  if (!client) {
    const p = profile || {};
    if (role === "founder" || role === "admin") {
      return `Hi — here is my three-minute pitch based on what I shared in my profile.\n\n${structured}\n\n---\n\nI am building ${p.startupOneLiner || "our product"} in ${p.industryType || "our target industry"} for ${p.icp || "a clear customer segment"}. We reach them through ${p.gtm || "our go-to-market motion"}. Today our biggest constraint is ${p.biggestBottleneck || "scaling what works"}. I am actively looking for ${p.lookingFor || "the right partners and tactical help"}, and I can contribute ${p.canHelp || "hands-on help back to the community"}. We are at stage ${p.stage || "early"}, with revenue around ${p.revenue || "early/pre-revenue"}, money raised ${p.moneyRaised || "not raised yet"}, team size ${String(p.teamSize ?? "")}, and roughly ${String(p.usersCount ?? "")} users.\n\nIf there is alignment, I would love a focused conversation on next steps this week.`;
    }
    return `Hi — here is my three-minute investor introduction based on my profile inputs.\n\n${structured}\n\n---\n\nI focus on ${p.preferredSector || "sectors I care about"}, typically at ${p.preferredStage || "stages I understand well"}. I look for ${p.tractionExpectation || "traction signals that matter"} and I am especially excited by ${p.investmentInterest || "these themes"}. I avoid ${p.redFlags || "patterns that do not fit"}, and I prefer founders who ${p.usersPreference || "match how I like to work"}.\n\nIf there is fit, I would love to explore diligence and introductions with clarity and speed.`;
  }

  const prompt =
    "Write a natural spoken 3-minute pitch (around 350-450 words), plain text only, no markdown. " +
    `Speaker role: ${role}. ` +
    "You MUST weave in the user's exact inputs below by name (quote or paraphrase faithfully—do not invent facts beyond these fields). " +
    "Structure: hook, problem, who it serves, approach/GTM, traction signals (industry/stage/revenue/money raised/team/users for founders), bottleneck, what they want, what they offer (founders) OR thesis, sectors, stages, expectations, red flags, preferences (investors). End with a clear ask.\n\n" +
    "USER INPUTS (use all that are non-empty):\n" +
    structured +
    "\n\nRAW JSON (same data, for reference only):\n" +
    profileJson;

  const response = await client.responses.create({ model: "gpt-4.1-mini", input: prompt });
  return (response.output_text || "").trim();
}
