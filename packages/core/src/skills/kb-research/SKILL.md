---
name: kb-research
description: answer KB questions with evidence-first retrieval, friction scoring, and conservative self-healing proposals
---

# KB Research

Use this skill when the user asks questions about facts, entities, relationships, or timelines in a KB universe.

## Goals

1. Answer the question directly and quickly.
2. Ground the answer in KB evidence first.
3. Escalate to source files only when KB evidence is thin.
4. Detect retrieval friction and propose targeted quality improvements.

## Tools to Use

- `kb_universe_list`
- `kb_index`
- `kb_search_batch`
- `kb_doc`
- `read`
- `glob`
- `task` (required)

## Inputs

- `universe` (optional)
- `question` (required)
- `approveTier2` (optional, default false)

## Orchestration Policy (Required)

- Always execute research in a spawned `task` subtask.
- Parent context is coordinator-only: resolve inputs, launch one focused research subtask, then summarize the result.
- Do not run full retrieval and healing directly in the parent context.

## Two-Tier Policy

- Tier 1 (automatic): low-risk fixes only (for example, adding clearly missing backlinks or tiny source-grounded relationship additions).
- Tier 2 (approval required): any broad rewrite, destructive cleanup, or identity-changing edit.
- Never claim fixes were applied unless at least one write succeeded.
- Always report write counters: attempted, succeeded, failed.

## Workflow

1. Resolve universe from input, else use default universe from config or a single available universe.
2. Run `kb_index` action `stats` and read `kb/<universe>/_meta/entities.json` for context.
3. Plan 3-8 search probes (entity names, aliases, event terms).
4. Run one `kb_search_batch` for those probes.
5. Read only the top relevant pages from `_data`.
6. If evidence is missing for a core claim, read narrow slices from `_raw` for validation.
7. Return:
   - direct answer,
   - evidence used (page paths and optional `_raw` paths),
   - confidence,
   - friction level (low/medium/high) with reason.
8. If friction suggests structural gaps, apply or propose improvements:
   - Tier 1: apply minimal safe edits via `kb_doc`.
   - Tier 2: report proposals; apply only when `approveTier2=true`.

## Friction Heuristics

- Low: answer from a small number of KB pages, no source fallback.
- Medium: requires many page hops or minor contradictions.
- High: core claims require `_raw` fallback or key entities are missing.

## Guardrails

- Keep retrieval focused; do not scan the entire KB unless required.
- Prefer `kb_search_batch` over repeated single lookups.
- Preserve provenance and never remove evidence without explicit approval.
- For large maintenance discovered during Q&A, open a follow-up task using `kb-review` or `kb-audit`.

## Response Contract

Return in this order:

1. Answer
2. Evidence Used
3. Confidence
4. Friction Assessment
5. Healing Actions (applied/proposed with counters)
