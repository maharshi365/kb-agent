import { universeManager } from "@kb/core";
import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool";

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
};
