import { loadKbConfig, type KbConfig } from "./config";
import { UniverseManager } from "./universe-manager";

export type CoreStatus = "ready" | "busy";

export const kbConfig: KbConfig = loadKbConfig();
export const universeManager = new UniverseManager(kbConfig);

export function getCoreStatus(): CoreStatus {
  return "ready";
}

export function getKbConfig(): KbConfig {
  return kbConfig;
}

export { getKbConfigPath, kbConfigSchema, loadKbConfig } from "./config";
export { UniverseManager } from "./universe-manager";
