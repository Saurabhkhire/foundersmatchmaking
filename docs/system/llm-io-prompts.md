# LLM IO Prompts

All LLM logic runs in backend: `backend/src/lib/openai.js`.

## Founder metadata extraction
- Function: `extractFounderMetadata(input)`
- Prompt: strict JSON extraction for founder schema
- Output keys: `industry,buyerType,gtmMotion,strengths,needs,stage,marketType,businessModel`
- Fallback: empty structured object

## Investor metadata extraction
- Function: `extractInvestorMetadata(input)`
- Prompt: strict JSON extraction for investor schema
- Output keys: `sectors,preferredStages,thesis,avoid,checkSizeEstimate`
- Fallback: empty structured object

## Embeddings
- Function: `embeddingFromText(text)`
- Model: `text-embedding-3-small`
- Output: 1536 vector
- Fallback: zero vector

## Match explanation generation
- Function: `buildMatchExplanation({roleA, roleB, highlights, score})`
- Prompt: strict JSON with `whyMatched[]` and `questions[]`
- Output: explanation bullets + suggested questions
- Fallback: deterministic defaults

## Pitch generation
- Function: `generateThreeMinutePitch(role, profile)`
- Founder prompt context includes:
  - startup one-liner
  - industry type
  - ICP
  - GTM
  - bottleneck
  - looking for
  - can help with
  - stage
  - revenue
  - money raised
  - team size
  - users count
- Investor prompt context includes thesis and preference fields.
- Output: plain-text ~3 minute pitch, editable by user.
- Fallback: deterministic paragraph using provided profile values.
