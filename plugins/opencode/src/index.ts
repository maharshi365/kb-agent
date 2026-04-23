import { universeManager } from "@kb/core";
import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin/tool";

function getUsageMessage(): string {
  return [
    "Usage:",
    "/kb-universe list",
    "/kb-universe add <universe>",
    "/kb-universe remove <universe>",
  ].join("\n");
}

function parseArguments(raw: string | undefined): string[] {
  const value = raw?.trim() ?? "";
  if (!value) {
    return [];
  }

  return value.split(/\s+/);
}

function handleUniverseCommand(args: string[]): string {
  const [action, universeName] = args;

  if (!action) {
    return getUsageMessage();
  }

  if (action === "list") {
    const universes = universeManager.getUniverses().map((universe) => universe.name);
    if (universes.length === 0) {
      return "No universes found.";
    }
    return `Universes:\n${universes.map((name) => `- ${name}`).join("\n")}`;
  }

  if (action === "add") {
    if (!universeName) {
      return "Missing universe name.\n\n" + getUsageMessage();
    }
    universeManager.createUniverse(universeName);
    return `Created universe '${universeName}'.`;
  }

  if (action === "remove") {
    if (!universeName) {
      return "Missing universe name.\n\n" + getUsageMessage();
    }

    const deleted = universeManager.deleteUniverse(universeName);
    if (!deleted) {
      return `Universe '${universeName}' not found.`;
    }

    return `Removed universe '${universeName}'.`;
  }

  return `Unknown subcommand '${action}'.\n\n${getUsageMessage()}`;
}

const server: Plugin = async () => {
  return {
    config: async (config) => {
      const next = config as Record<string, unknown>;
      const command = (next.command as Record<string, unknown> | undefined) ?? {};

      command["kb-universe"] = {
        description: "Manage KB universes",
        template:
          'Use the "kb_universe" tool to run: "$ARGUMENTS". Return only the tool output text.',
      };

      next.command = command;
    },
    tool: {
      kb_universe: tool({
        description: "Manage KB universes: list, add <name>, remove <name>",
        args: {
          input: tool.schema
            .string()
            .describe("Arguments after /kb-universe, for example: list, add demo, remove demo"),
        },
        async execute(args) {
          return handleUniverseCommand(parseArguments(args.input));
        },
      }),
    },
  };
};

export default {
  id: "@kb/plugin-opencode",
  server,
};
