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
      kb_universe_delete: true,
      kb_entities_get: true,
      kb_entities_set: true,
      kb_entity_delete: true,
      kb_index: true,
      kb_search_batch: true,
      kb_doc: true,
    },
    permission: {
      "kb_*": "allow",
      skill: {
        "internal-*": "allow",
      },
    },
    prompt: kbAgentPrompt,
  };
}
