import type { Plugin } from "@opencode-ai/plugin";
import { buildKbAgentDef } from "./agents/kb-agent";
import { kbManagementTools } from "./tools/kb-management";

type PluginConfig = {
  agent?: Record<string, unknown>;
};

const kbToolDenyPermissions: Record<string, string> = {
  "kb_*": "deny",
};

const server: Plugin = async () => {
  return {
    config: async (config: PluginConfig) => {
      const agentDefs = config.agent ?? {};

      for (const [agentName, agentDef] of Object.entries(agentDefs)) {
        if (agentName === "kb-agent") {
          continue;
        }

        if (!agentDef || typeof agentDef !== "object") {
          continue;
        }

        const typedAgentDef = agentDef as Record<string, unknown>;
        const existingPermission =
          typedAgentDef.permission && typeof typedAgentDef.permission === "object"
            ? (typedAgentDef.permission as Record<string, unknown>)
            : {};

        typedAgentDef.permission = {
          ...existingPermission,
          ...kbToolDenyPermissions,
        };
      }

      agentDefs["kb-agent"] = buildKbAgentDef();
      config.agent = agentDefs;
    },
    tool: kbManagementTools,
  };
};

export default {
  id: "@kb/plugin-opencode",
  server,
};
