import { loadKbConfig, type KbConfig } from "./config";

export type CoreStatus = "ready" | "busy";

export const kbConfig: KbConfig = loadKbConfig();

export function getCoreStatus(): CoreStatus {
  return "ready";
}

export function getKbConfig(): KbConfig {
  return kbConfig;
}

export { getKbConfigPath, kbConfigSchema, loadKbConfig } from "./config";
