---
name: kb-ingestion
description: ingest markdown from _inbox into _data with grounded extraction, batch entity matching, and validated Obsidian writes
---

# KB Ingestion

Use this skill when the user wants to ingest source documents into a universe knowledge base.

## Goals

1. Process markdown from `_inbox`.
2. Extract source-grounded entities from text.
3. Merge into `_data` through validated write/edit operations.
4. Regenerate indexes.
5. Move processed source files into `_raw`.
6. Run post-ingestion review for duplicates, dead links, and orphaned pages.

## Tools to Use

- `kb_universe_list`
- `kb_entities_get`
- `kb_index`
- `kb_search_batch`
- `kb_doc`
- `task` (required for orchestration)
- `read`
- `glob`
- `bash`

## Runtime Structure

Each universe uses:

- `_meta/entities.json` for entity definitions
- `_inbox/` for pending source markdown files
- `_raw/` for archived processed source files
- `_data/` for Obsidian entity docs and type indexes

## Orchestration Policy (Required)

- You must use the `task` tool to orchestrate ingestion work.
- The root ingestion agent acts as coordinator only: resolve universe, gather file list, launch subagents, and run final indexing/move/report steps.
- Launch one subagent per source file in `_inbox/`.
- Each per-file subagent must run as a KB ingestion worker (a fresh KB-agent-style execution for that file) and handle:
  - reading the file,
  - extracting grounded entities,
  - one `kb_search_batch` for that file,
  - `kb_doc` upserts for that file.
- Do not batch multiple source files into the same subagent.
- If a subagent fails for one file, continue with the remaining files and report per-file failures.

## Workflow

1. Resolve target universe.
2. Read `entities.json` for valid entity types and extraction focus.
3. List markdown files in `_inbox/`. Stop if empty.
4. Use `task` to launch one subagent per source file.
5. Each subagent processes exactly one file:
   - Read source markdown.
   - Extract candidate entities with direct evidence.
   - Use one `kb_search_batch` call for all candidates in that file.
   - For each candidate, call `kb_doc` action `upsert-entity`.
6. Aggregate subagent results (success/failure and per-file write counts).
7. After all files are processed, call `kb_doc` action `regenerate-index`.
8. Move successfully processed files from `_inbox/` to `_raw/` using system mv commands.
9. Call `kb_index` action `rebuild`.
10. Launch a new `task` for post-ingestion review that activates `kb-review` for the same universe.
11. Report created/updated counts, per-file outcomes, failures, index stats, and review outcomes.

## Post-Ingestion Review Task (Required)

- After `kb_index` rebuild completes, launch a separate `task` invocation.
- In that new task, request a KB review sweep for the same universe with a bounded count (default 25).
- The review task must run fixes in this order: duplicates, dead links, orphaned pages.
- Use the review skill

## Extraction Rules

- Only include entities supported by direct source evidence.
- Prefer concise factual overview additions (1-3 sentences).
- Use wikilinks in related references: `[[Entity Name]]`.
- Skip weak or ambiguous candidates.

## Write Rules

- Do not write entity markdown directly with edit/write tools.
- Use `kb_doc` for all entity and index writes.
- If `kb_doc` returns validation errors, fix payload and retry.

## Batch Matching Policy

- Use `kb_search_batch` for lookups during ingestion.
- Avoid repeated single-entity search calls for the same source file.
