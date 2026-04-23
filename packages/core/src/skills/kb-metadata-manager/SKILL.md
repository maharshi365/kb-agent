---
name: kb-metadata-manager
description: create a new KB universe, design metadata entities, and maintain _meta/entities.json with schema-safe updates
---

# KB Metadata Manager

Use this skill when the user wants to create a knowledge base, define or edit entity metadata, or update `_meta/entities.json`.

## Goals

1. Understand what kind of knowledge base the user is building.
2. Produce a valid `_meta/entities.json` payload.
3. Apply updates safely using KB tools.
4. Optionally update Obsidian graph/search config files when explicitly requested.

## Tools to Use

- `kb_universe_list`
- `kb_universe_create`
- `kb_universe_delete`
- `kb_entities_get`
- `kb_entities_set`
- `kb_entity_delete`
- `glob`
- `read`
- `edit`

## Required Discovery Questions

Ask these before generating entities when requirements are unclear:

1. What is the KB domain? (engineering docs, research papers, customer calls, legal docs, etc.)
2. What outcomes should extraction support? (search, analytics, QA, compliance, incident review, etc.)
3. What are the top 5-10 entity types that matter most?
4. What evidence quality bar is needed? (strict quotes only, short excerpts, permissive snippets)
5. Are there dependencies between entities? (for `requiredEntities`)
6. Any examples that should be considered invalid or ignored?

If the user cannot answer fully, propose a practical default entity set and ask for confirmation.

Default evidence bar when unspecified:

- Use direct quotes when possible.
- If a direct quote is too long, use a tight excerpt (1-3 sentences) that preserves the original meaning.
- Include enough surrounding context to verify the extracted fact without re-reading the full source.

## Entities JSON Contract

Write entities as:

```json
{
  "schema": "https://raw.githubusercontent.com/maharshi365/Kbaas/main/schemas/entities.schema.json",
  "value": [
    {
      "name": "EntityName",
      "description": "What this entity represents in this KB",
      "extractionFocus": "What to extract for this entity",
      "examples": ["Concrete example 1", "Concrete example 2"],
      "evidence": "Provide a direct quote or a tight source-grounded excerpt that supports the extracted facts for this entity.",
      "rules": ["Optional extraction rule"],
      "invalid": ["Optional invalid example"],
      "requiredEntities": ["OtherEntityName"]
    }
  ]
}
```

Validation expectations:

- `name`, `description`, `extractionFocus` must be non-empty strings.
- `examples` must contain at least one non-empty example.
- `requiredEntities` must reference other existing entity names and cannot self-reference.
- Keep entity names stable once adopted.

## Evidence Quality Guidance

When defining entity metadata, explain to the user what is "good enough" evidence for extraction:

- `Good`: direct quote or tight excerpt that clearly supports the exact extracted fact.
- `Good`: includes source-grounded wording (not a paraphrase that adds new claims).
- `Good`: specific enough that a reviewer can validate the claim quickly.
- `Not good`: vague snippets, summaries without source wording, or excerpts that do not prove the stated fact.

Use this practical rule:

- If a reviewer asks "where exactly does this claim come from?", the evidence should answer that in one read.

When users ask for a looser standard, keep evidence minimally verifiable: at least one concrete source-grounded excerpt per extracted fact.

## Workflow

1. Confirm or create target universe.
2. Inspect current entities via `kb_entities_get`.
3. Ask discovery questions and draft entities.
4. Show proposed entities for user confirmation on substantial changes.
5. Persist with `kb_entities_set`.
6. Report what changed (added/updated/removed entities).

## Optional Obsidian Config Edits

When the user explicitly asks to adjust Obsidian graph colors or search behavior for a universe, handle it as an optional metadata task with strict file-presence guards.

### Supported Targets

- Obsidian config location for this project is under `_data/.obsidian/` inside the universe.
- Graph colors: prefer `_data/.obsidian/graph.json`.
- Search-related config: only edit a concrete file/path the user requested under `_data/.obsidian/` (or an existing known Obsidian config file there, such as `_data/.obsidian/workspace.json`).

### Required Guardrails

1. Check that the target file exists before editing.
2. If the file does not exist, do nothing and report: `Skipped: <path> not present`.
3. Never create missing Obsidian config files for this workflow.
4. Preserve unknown JSON keys; apply minimal key-level edits only.
5. If requested search behavior is ambiguous, only apply explicit, unambiguous key updates.

### Suggested Sequence

1. Resolve universe path.
2. Verify file presence with `glob`/`read`.
3. If present, apply targeted JSON edits.
4. Report exact keys changed and skipped files.

## Editing Policy

- Preserve stable entity names unless the user explicitly requests renaming.
- Prefer additive edits first; delete only when clearly obsolete.
- Keep descriptions and extraction focus specific to the KB domain.
