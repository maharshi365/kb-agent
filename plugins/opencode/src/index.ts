import type { Plugin } from "@opencode-ai/plugin";
import { buildKbAgentDef } from "./agents/kb-agent";
import { kbManagementTools } from "./tools/kb-management";

type PluginConfig = {
  permission?: Record<string, unknown>;
  agent?: Record<string, unknown>;
};

const kbToolDenyPermissions: Record<string, string> = {
  "kb_*": "deny",
};

const server: Plugin = async () => {
  return {
    config: async (config: PluginConfig) => {
      config.permission = {
        ...(config.permission ?? {}),
        ...kbToolDenyPermissions,
      };

      const agentDefs = config.agent ?? {};

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
