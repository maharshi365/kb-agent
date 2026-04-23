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

## Workflow

1. Resolve target universe.
2. Run `kb_index` action `duplicates` with `limit=count`.
3. For each duplicate group, merge into a canonical node:
    - Prefer the file with richer sources/evidence as canonical.
    - Read source files as needed before destructive changes.
    - Write merged/canonical content first, validate it, and only then delete the superseded page.
    - Rewrite or consolidate links so all references point at the canonical node.
4. Re-run `duplicates` to confirm reduction.
5. Run `kb_index` action `dead-links` with `limit=count`.
6. For each dead link:
   - Try to resolve with `kb_search_batch` for likely existing nodes.
   - If confidence is high, update links to existing nodes.
   - If unresolved, remove or rewrite the broken reference conservatively.
7. Re-run `dead-links` to confirm reduction.
8. Run `kb_index` action `orphaned-pages` with `limit=count`.
9. For each orphan page:
   - Read the page and relevant linked/source material.
   - Add at least one meaningful inbound or outbound relationship.
   - If the page is a true duplicate fragment, merge it into a stronger node.
10. Re-run `orphaned-pages` and report before/after counts for all stages.

## Guardrails

- Prefer minimal, reversible edits first.
- Keep frontmatter valid via `kb_doc` writes.
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
