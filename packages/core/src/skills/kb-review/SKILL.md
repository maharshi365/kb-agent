---
name: kb-review
description: review KB nodes for duplicates, dead links, and orphaned pages, then apply safe fixes in that order
---

# KB Review

Use this skill when the user asks to review or heal KB graph quality issues.

## Goals

1. Detect and fix duplicate nodes first.
2. Detect and fix dead links second.
3. Detect and fix orphaned pages last.
4. Limit result volume passed to the agent while preserving total counts.
5. Keep fixes conservative and track execution truthfully.

## Tools to Use

- `kb_index`
- `kb_search_batch`
- `kb_doc`
- `task`
- `read`
- `glob`

## Inputs

- `universe` (required): target universe.
- `count` (optional): max issue items to retrieve per diagnostic call.

If `count` is omitted, default to `25`.

## Orchestration Policy (Required)

- Always run review work in a `task` subtask.
- The invoking agent acts as coordinator only: resolve inputs, launch the review subtask, then summarize results.
- Do not perform full review/fix work directly in the parent context.

## Required Repair Order

Always run and fix in this order:

1. `duplicates`
2. `dead-links`
3. `orphaned-pages`

Do not skip ahead unless the earlier stage reports zero issues.

## Two-Tier Policy

- Tier 1 (automatic): safe, reversible edits (link repoints with high confidence, missing backlink additions, frontmatter cleanup, index regeneration).
- Tier 2 (approval required): destructive or identity-changing operations (entity deletion, broad merge/rename, speculative link rewrites).
- If Tier 2 is not approved, report proposals only.
- Never claim fixes were applied unless write calls succeeded.
- Always report write counters: attempted, succeeded, failed.

## Workflow

1. Resolve target universe.
2. Run `kb_index` action `duplicates` with `limit=count`.
3. For each duplicate group, resolve conservatively:
    - Prefer one canonical node based on richer sources/evidence.
    - Tier 1 default: normalize links to canonical node and preserve both pages.
    - Tier 2 optional: remove superseded page only with explicit approval.
4. Re-run `duplicates` to confirm reduction.
5. Run `kb_index` action `dead-links` with `limit=count`.
6. For each dead link:
    - Try to resolve with `kb_search_batch` for likely existing nodes.
    - If confidence is high, update links to existing nodes.
    - If unresolved, keep reference and report it unless safe rewrite is obvious.
7. Re-run `dead-links` to confirm reduction.
8. Run `kb_index` action `orphaned-pages` with `limit=count`.
9. For each orphan page:
    - Read the page and relevant linked/source material.
    - Add at least one meaningful inbound or outbound relationship.
    - If page appears to be duplicate fragment, report Tier 2 proposal unless explicitly approved.
10. Re-run `orphaned-pages` and report before/after counts for all stages.

## Guardrails

- Prefer minimal, reversible edits first.
- Keep frontmatter valid via `kb_doc` writes.
- If using `kb_doc` write-entity, send `entityData.frontmatter` + `entityData.body` only (never `entityData.content`).
- Require post-write `kb_doc verify` for touched files before claiming a fix succeeded.
- Preserve evidence and source provenance while merging.
- Never delete first: create or update replacement content and links before deleting old pages.
- If an item cannot be safely auto-fixed, report it explicitly with reason.

## Reporting

Return a concise report with:

- universe
- limit used
- duplicates: before, fixed, after
- dead-links: before, fixed, after
- orphaned-pages: before, fixed, after
- unresolved items and next steps
