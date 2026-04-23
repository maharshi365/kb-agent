import { ENTITIES_SCHEMA_URL, universeManager } from "@kb/core";
import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool";

function getUniverseOrMessage(name: string) {
  const universe = universeManager.getUniverse(name);
  if (!universe) {
    return `Universe '${name}' does not exist.`;
  }

  return universe;
}

export const kbManagementTools: Record<string, ToolDefinition> = {
  kb_universe_list: tool({
    description: "List all KB universes",
    args: {},
    async execute(_args, _context) {
      const universes = universeManager.getUniverses().map((universe) => universe.name);

      if (universes.length === 0) {
        return "No universes found.";
      }

      return `Universes:\n${universes.map((name) => `- ${name}`).join("\n")}`;
    },
  }),
  kb_universe_create: tool({
    description: "Create a KB universe",
    args: {
      name: tool.schema.string().describe("Universe name to create"),
    },
    async execute(args, _context) {
      const universeName = args.name.trim();
      if (!universeName) {
        return "Missing universe name.";
      }

      universeManager.createUniverse(universeName);
      return `Created universe '${universeName}'.`;
    },
  }),
  kb_universe_delete: tool({
    description: "Delete a KB universe",
    args: {
      name: tool.schema.string().describe("Universe name to delete"),
    },
    async execute(args, _context) {
      const universeName = args.name.trim();
      if (!universeName) {
        return "Missing universe name.";
      }

      const deleted = universeManager.deleteUniverse(universeName);
      if (!deleted) {
        return `Universe '${universeName}' does not exist.`;
      }

      return `Deleted universe '${universeName}'.`;
    },
  }),
  kb_entities_get: tool({
    description: "Get _meta/entities.json for a universe",
    args: {
      universe: tool.schema.string().describe("Universe name"),
    },
    async execute(args, _context) {
      const universeName = args.universe.trim();
      if (!universeName) {
        return "Missing universe name.";
      }

      const universeOrMessage = getUniverseOrMessage(universeName);
      if (typeof universeOrMessage === "string") {
        return universeOrMessage;
      }

      const entities = universeOrMessage.getEntities();
      return JSON.stringify(
        {
          schema: ENTITIES_SCHEMA_URL,
          value: entities,
        },
        null,
        2,
      );
    },
  }),
  kb_entities_set: tool({
    description: "Replace _meta/entities.json for a universe",
    args: {
      universe: tool.schema.string().describe("Universe name"),
      entitiesJson: tool.schema
        .string()
        .describe("JSON array of entities or full entities file object"),
    },
    async execute(args, _context) {
      const universeName = args.universe.trim();
      if (!universeName) {
        return "Missing universe name.";
      }

      const universeOrMessage = getUniverseOrMessage(universeName);
      if (typeof universeOrMessage === "string") {
        return universeOrMessage;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(args.entitiesJson);
      } catch {
        return "entitiesJson must be valid JSON.";
      }

      const nextEntities =
        parsed && typeof parsed === "object" && "value" in parsed
          ? (parsed as { value: unknown }).value
          : parsed;

      if (!Array.isArray(nextEntities)) {
        return "entitiesJson must be an array of entities or an object with a 'value' array.";
      }

      universeOrMessage.setEntities(nextEntities);
      return `Updated entities for '${universeName}' (${nextEntities.length} entries).`;
    },
  }),
  kb_entity_delete: tool({
    description: "Delete one entity from a universe",
    args: {
      universe: tool.schema.string().describe("Universe name"),
      name: tool.schema.string().describe("Entity name to delete"),
    },
    async execute(args, _context) {
      const universeName = args.universe.trim();
      const entityName = args.name.trim();

      if (!universeName) {
        return "Missing universe name.";
      }

      if (!entityName) {
        return "Missing entity name.";
      }

      const universeOrMessage = getUniverseOrMessage(universeName);
      if (typeof universeOrMessage === "string") {
        return universeOrMessage;
      }

      const deleted = universeOrMessage.deleteEntity(entityName);
      if (!deleted) {
        return `Entity '${entityName}' does not exist in universe '${universeName}'.`;
      }

      return `Deleted entity '${entityName}' from universe '${universeName}'.`;
    },
  }),
};
