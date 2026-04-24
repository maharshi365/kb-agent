---
name: kb-audit
description: audit KB factual quality by validating entity content against source evidence and scoring answer reliability
---

# KB Audit

Use this skill when the user asks for QA auditing, hallucination checks, unsupported-claim detection, or content quality scoring.

## Goals

1. Select one or more high-impact entities to audit.
2. Build source-grounded truth from `_raw`.
3. Interrogate current KB answers using `kb-research` style retrieval.
4. Score quality and identify missing, wrong, or unsupported content.
5. Apply safe additions automatically and gate risky edits behind approval.

## Tools to Use

- `kb_universe_list`
- `kb_index`
- `kb_search_batch`
- `kb_entity_upsert`
- `kb_entity_write`
- `kb_verify`
- `read`
- `glob`
- `task`

## Inputs

- `universe` (optional)
- `entity` (optional)
- `type` (optional)
- `count` (optional, default 1)
- `approveTier2` (optional, default false)

## Orchestration Rule

- Always execute audit in a spawned `task` subtask.
- Keep this skill coordinator-first.
- For each audit question, dispatch a focused `task` that runs KB question answering behavior (same retrieval standards as `kb-research`).
- Run question tasks sequentially for one entity so earlier fixes can improve later answers.

## Two-Tier Policy

- Tier 1 (automatic): additive, low-risk improvements (missing evidence blocks, clearly missing relationships/backlinks).
- Tier 2 (approval required): removals, rewrites, or identity/canonicalization changes.
- Unsupported claim removal is always Tier 2.
- Never claim applied fixes without successful writes.
- Always report attempted/succeeded/failed counts.
- If `kb_entity_write` is used, require `entityData.frontmatter` + `entityData.body` (never `entityData.content`) and verify non-empty body before reporting success.

## Workflow

1. Resolve universe and read `kb/<universe>/_meta/entities.json`.
2. Run `kb_index` action `stats` and `list` to pick candidate entities.
3. Select target entity:
   - use explicit `entity` when provided,
   - else prioritize sparse entities (few sources, short content, weak linking).
4. Read audited entity plus supporting `_raw` sources.
5. Generate 6-10 targeted factual questions:
   - identity,
   - relationships,
   - events/actions,
   - completeness probe,
   - unsupported-claim probe.
6. Ask each question via sequential tasks and capture evidence quality, confidence, and friction.
7. Score each answer:
   - COMPLETE, PARTIAL, MISSING, WRONG, HALLUCINATED.
8. Build improvement plan:
   - PARTIAL -> Tier 1 additions,
   - MISSING/WRONG/HALLUCINATED -> Tier 2 proposals.
9. Apply Tier 1 via split KB write tools, verify touched pages with `kb_verify`.
10. Return structured report with entity profile, score table, negative signals, and proposals.

## Negative Signals to Check

- Relationship asserted in KB but unsupported by `_raw` evidence.
- Evidence quote not present in referenced source text.
- Overview claim lacking supporting evidence.
- Phantom references to non-existent entities.

## Batch Audits

- If `count > 1`, audit entities sequentially.
- Avoid re-auditing the same entity in one run.
- End with a batch summary table and aggregate quality rate.
