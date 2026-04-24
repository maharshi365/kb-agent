---
name: kb-ingestion
description: ingest markdown from _inbox into _data with grounded extraction, batch entity matching, and validated Obsidian writes
---

# KB Ingestion

Use this skill when the user wants to ingest source documents into a universe knowledge base.

## Goals

1. Process markdown from `_inbox`.
2. Extract source-grounded entities from text.
3. Merge into `_data` through validated tool operations.
4. Regenerate indexes.
5. Move processed source files into `_raw`.
6. Run post-ingestion review for duplicates, dead links, and orphaned pages.
7. Keep root orchestration thin and reusable across workflows.

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

- You must use `task` for ingestion execution.
- Every ingestion `task` call must set `subagent_type` to `kb-processor` (never `general`).
- Root context is coordinator-only: resolve universe, gather files, launch subtasks, aggregate results, run final indexing and archive steps.
- Launch one subtask per source file in `_inbox/` (batched launches are fine; each subtask handles one file only).
- Never launch a single ingestion subtask that handles multiple files.
- If there are N inbox files, launch N ingestion subtasks.
- Prefer parallel launches for independent file subtasks.
- Reuse the same KB workflow style used by other skills: focused subtask, bounded scope, explicit counters.
- If one subtask fails, continue with remaining files and report per-file failures.

## Workflow

1. Resolve target universe.
2. Read `entities.json` for valid entity types and extraction focus.
3. List markdown files in `_inbox/`. Stop if empty.
4. Use `task` to launch one subtask per source file.
5. Each subtask processes exactly one file:
   - Read source markdown.
   - Extract candidate entities with direct evidence.
   - Use one `kb_search_batch` call for all candidates in that file.
   - For each candidate, call `kb_doc` action `upsert-entity`.
6. Aggregate subagent results (success/failure and per-file write counts).
7. After all files are processed, call `kb_doc` action `regenerate-index`.
8. Move successfully processed files from `_inbox/` to `_raw/` using system mv commands.
9. Call `kb_index` action `rebuild`.
10. Launch a new `task` for post-ingestion review using `subagent_type: kb-reviewer` for the same universe.
11. Report created/updated counts, per-file outcomes, failures, index stats, and review outcomes.

### Required Completion Gate (File Archival)

- Ingestion is not complete until archival is attempted for every successfully processed source file.
- After per-file tasks finish, root orchestration must move each successful `source_file` from `_inbox/` to `_raw/` in the same universe.
- If a move fails, keep processing remaining files and report that file as `archive_failed` with the error.
- Final report must include: `archive_attempted`, `archive_succeeded`, `archive_failed`, and `archive_failed_files`.
- On Windows shells, use `Move-Item -LiteralPath <source> -Destination <dest-dir> -Force`.
- On POSIX shells, use `mv <source> <dest-dir>/`.

## Subtask Prompt Contract (Required)

Every per-file ingestion task prompt must include:

- Universe slug and directory context.
- Exactly one `source_file` absolute path.
- A hard constraint: "Process only this file. Do not read or process any other inbox file."
- Expected result shape: writes attempted/succeeded/failed, created/updated counts, and any validation errors.
- Explicit `subagent_type: kb-processor` in the task tool input.

Recommended prompt scaffold:

```text
Ingest one KB source file.
KB Root Dir: <kb-root>
Universe: <slug>
Universe Dir: <universe-dir>
source_file: <absolute-path>

Requirements:
- Process only this file. Do not read/process any other inbox file.
- Read the source markdown, extract grounded entities, and run one kb_search_batch for all candidates in this file.
- Upsert entities via kb_doc only.
- Return counters: writes_attempted, writes_succeeded, writes_failed, created, updated, failed_entities.
```

## Post-Ingestion Review Task (Required)

- After `kb_index` rebuild completes, launch a separate `task` invocation.
- In that new task, request a KB review sweep for the same universe with a bounded count (default 25).
- The review task must run fixes in this order: duplicates, dead links, orphaned pages.
- Use `kb-reviewer` and include the ingestion run context in the prompt.

## Extraction Rules

- Only include entities supported by direct source evidence.
- Prefer concise factual overview additions (1-3 sentences).
- Use wikilinks in related references: `[[Entity Name]]`.
- Skip weak or ambiguous candidates.

## Write Rules

- Do not write entity markdown directly with edit/write tools.
- Use `kb_doc` for all entity and index writes.
- If `kb_doc` returns validation errors, fix payload and retry.
- For `kb_doc write-entity`, use `entityData.frontmatter` + `entityData.body`; never send `entityData.content`.
- Never mark a file as successfully processed until write success and non-empty body verification both pass.

## Batch Matching Policy

- Use `kb_search_batch` for lookups during ingestion.
- Avoid repeated single-entity search calls for the same source file.

## Execution Truthfulness

- Track and report counts for writes attempted, writes succeeded, and writes failed.
- Never describe planned or attempted writes as completed.
