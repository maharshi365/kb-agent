import {
  kbDoc,
  kbEntitiesGet,
  kbEntitiesSet,
  kbEntityDelete,
  kbIndex,
  kbSearchBatch,
  kbUniverseCreate,
  kbUniverseDelete,
  kbUniverseList,
} from "@kb/core";
import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool";

export const kbManagementTools: Record<string, ToolDefinition> = {
  kb_universe_list: tool({
    description: "List all KB universes",
    args: {},
    async execute(_args, _context) {
      return kbUniverseList();
    },
  }),
  kb_universe_create: tool({
    description: "Create a KB universe",
    args: {
      name: tool.schema.string().describe("Universe name to create"),
    },
    async execute(args, _context) {
      return kbUniverseCreate(args.name);
    },
  }),
  kb_universe_delete: tool({
    description: "Delete a KB universe",
    args: {
      name: tool.schema.string().describe("Universe name to delete"),
    },
    async execute(args, _context) {
      return kbUniverseDelete(args.name);
    },
  }),
  kb_entities_get: tool({
    description: "Get _meta/entities.json for a universe",
    args: {
      universe: tool.schema.string().describe("Universe name"),
    },
    async execute(args, _context) {
      return kbEntitiesGet(args.universe);
    },
  }),
  kb_entities_set: tool({
    description: "Replace _meta/entities.json for a universe",
    args: {
      universe: tool.schema.string().describe("Universe name"),
      entitiesJson: tool.schema.string().describe("JSON array or full entities file object"),
    },
    async execute(args, _context) {
      return kbEntitiesSet(args.universe, args.entitiesJson);
    },
  }),
  kb_entity_delete: tool({
    description: "Delete one entity from a universe",
    args: {
      universe: tool.schema.string().describe("Universe name"),
      name: tool.schema.string().describe("Entity name to delete"),
    },
    async execute(args, _context) {
      return kbEntityDelete(args.universe, args.name);
    },
  }),
  kb_index: tool({
    description: "List entities by type, get stats, or rebuild manifest index",
    args: {
      universe: tool.schema.string().describe("Universe name"),
      action: tool.schema
        .enum(["list", "stats", "rebuild", "duplicates", "dead-links", "orphaned-pages"])
        .describe("Index action"),
      type: tool.schema.string().optional().describe("Optional entity type filter"),
      limit: tool.schema.number().optional().describe("Optional result cap for diagnostic actions"),
    },
    async execute(args, _context) {
      return kbIndex(args);
    },
  }),
  kb_search_batch: tool({
    description: "Search many entity names in one filesystem scan",
    args: {
      universe: tool.schema.string().describe("Universe name"),
      queries: tool.schema.string().describe("JSON array of { query, type? }"),
      fuzzy: tool.schema.boolean().optional().describe("Enable fuzzy search (default true)"),
    },
    async execute(args, _context) {
      return kbSearchBatch(args);
    },
  }),
  kb_doc: tool({
    description: "Validated Obsidian frontmatter write/edit tool",
    args: {
      universe: tool.schema.string().describe("Universe name"),
      action: tool.schema
        .enum(["upsert-entity", "write-entity", "regenerate-index", "verify"])
        .describe("Document action"),
      upsertData: tool.schema.string().optional().describe("JSON payload for upsert-entity"),
      entityData: tool.schema.string().optional().describe("JSON payload for write-entity"),
      path: tool.schema.string().optional().describe("Optional scope path for verify/regenerate-index"),
    },
    async execute(args, _context) {
      return kbDoc(args);
    },
  }),
};
