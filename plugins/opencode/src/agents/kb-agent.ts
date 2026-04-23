import { kbAgentPrompt } from "@kb/core";

export function buildKbAgentDef(): Record<string, unknown> {
  return {
    description: "Manage knowledge base universes and content.",
    mode: "all",
    color: "#2f6f4f",
    temperature: 0.1,
    tools: {
      kb_universe_list: true,
      kb_universe_create: true,
    },
    prompt: kbAgentPrompt,
  };
}
