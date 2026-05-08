---
name: write-system-docs
description: Generate complete system documentation in both markdown and docx formats for architecture, workflows, database structure, LLM input-output prompts, technical file flow, per-method input-output contracts, and positive/negative API+UI test cases. Use when users ask for technical docs, handover docs, audit docs, or test documentation.
disable-model-invocation: true
---

# Write System Docs

## When to use

Use this skill when the user asks for technical documentation that must cover:
- architecture
- workflows
- database structure
- LLM prompts with input, output, system prompt, and user prompt
- technical flow with full file structure
- every method in each file with input and output
- API and UI test cases with positive and negative scenarios

## Required output files

Write outputs into `docs/system/` with these files:
1. `architecture.md`
2. `workflows.md`
3. `database-structure.md`
4. `llm-io-prompts.md`
5. `tech-flow-file-structure.md`
6. `method-io-contracts.md`
7. `test-cases-api-ui.md`
8. `system-docs.docx` (compiled document)

## Mandatory process

1. Inspect both top-level folders: `frontend/` and `backend/`.
2. Build a complete file inventory grouped by folder.
3. For each source file, list exported functions/methods and summarize:
   - input
   - output
   - side effects
   - error cases
4. Document request/response contract for every API route.
5. Add API test matrix with:
   - positive case(s)
   - negative case(s)
   - expected status code
   - expected payload shape
6. Add UI test matrix with:
   - positive flow(s)
   - negative flow(s)
   - expected UI behavior
7. If LLM is used, include exact prompt sections:
   - system prompt
   - user prompt
   - input payload
   - output schema
8. Generate all markdown files first.
9. Convert markdown into one `.docx` file.

## Doc quality rules

- Use concrete file paths and method names.
- Do not skip backend or frontend.
- Avoid vague bullets like "handles errors"; specify error behavior.
- Keep content implementation-true to current code.
- Mark unknowns as `TODO` explicitly.

## Recommended section templates

Use templates from `templates/system-doc-template.md`.

## DOCX generation

Use `scripts/build_docx.py`:

```bash
python .cursor/skills/write-system-docs/scripts/build_docx.py docs/system system-docs.docx
```

If `python-docx` is missing, install it:

```bash
pip install python-docx
```

## Completion checklist

- [ ] All 7 markdown docs created
- [ ] Both `frontend` and `backend` covered
- [ ] Every API route includes positive + negative tests
- [ ] UI tests include positive + negative flows
- [ ] `system-docs.docx` created
