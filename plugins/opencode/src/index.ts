import type { Plugin } from "@opencode-ai/plugin";
import { kbManagementTools } from "./tools/kb-management";

const server: Plugin = async () => {
  return {
    tool: kbManagementTools,
  };
};

export default {
  id: "@kb/plugin-opencode",
  server,
};
