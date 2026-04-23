import { universeManager } from "@kb/core";
import type { Plugin } from "@opencode-ai/plugin";

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

export const KbUniversePlugin: Plugin = async () => {
  return {
    "command.execute.before": async (input, output) => {
      if (input.command !== "kb-universe") {
        return;
      }

      try {
        output.parts = [
          { type: "text", text: handleUniverseCommand(parseArguments(input.arguments)) } as never,
        ];
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error.";
        output.parts = [{ type: "text", text: `kb-universe failed: ${message}` } as never];
      }
    },
  };
};
