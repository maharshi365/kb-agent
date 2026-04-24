import {
  kbEntityMerge,
  kbEntityUpsert,
  kbEntityWrite,
  kbEntitiesGet,
  kbEntitiesSet,
  kbEntityDelete,
  kbIndexRegenerate,
  kbIndex,
  kbVerify,
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
  kb_entity_upsert: tool({
    description: "Upsert KB entity evidence and relationships",
    args: {
      universe: tool.schema.string().describe("Universe name"),
      upsertData: tool.schema.string().describe("JSON payload for upsert-entity"),
    },
    async execute(args, _context) {
      return kbEntityUpsert({ universe: args.universe, upsertData: args.upsertData });
    },
  }),
  kb_entity_write: tool({
    description: "Write full KB entity file with strict validation",
    args: {
      universe: tool.schema.string().describe("Universe name"),
      entityData: tool.schema
        .string()
        .describe("JSON payload for write-entity. Must include frontmatter + non-empty body. 'content' is not supported."),
    },
    async execute(args, _context) {
      return kbEntityWrite({ universe: args.universe, entityData: args.entityData });
    },
  }),
  kb_entity_merge: tool({
    description: "Merge two KB entities, rewrite references, and delete source",
    args: {
      universe: tool.schema.string().describe("Universe name"),
      sourcePath: tool.schema.string().describe("Source entity path (merged from)"),
      targetPath: tool.schema.string().describe("Target entity path (merged into)"),
    },
    async execute(args, _context) {
      return kbEntityMerge({ universe: args.universe, sourcePath: args.sourcePath, targetPath: args.targetPath });
    },
  }),
  kb_verify: tool({
    description: "Verify KB entities in scope",
    args: {
      universe: tool.schema.string().describe("Universe name"),
      path: tool.schema.string().optional().describe("Optional file or folder scope"),
    },
    async execute(args, _context) {
      return kbVerify({ universe: args.universe, path: args.path });
    },
  }),
  kb_index_regenerate: tool({
    description: "Regenerate KB index files in scope",
    args: {
      universe: tool.schema.string().describe("Universe name"),
      path: tool.schema.string().optional().describe("Optional folder scope for one entity type"),
    },
    async execute(args, _context) {
      return kbIndexRegenerate({ universe: args.universe, path: args.path });
    },
  }),
};
