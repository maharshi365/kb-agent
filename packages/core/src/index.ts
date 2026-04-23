import { UniverseManager, type KbConfig } from "./universe-manager";

export type CoreStatus = "ready" | "busy";

export const universeManager = new UniverseManager();
export const kbConfig: KbConfig = universeManager.getKbConfig();

export function getCoreStatus(): CoreStatus {
  return "ready";
}

export function getKbConfig(): KbConfig {
  return kbConfig;
}

export { Universe } from "./universe";
export { kbConfigSchema, UniverseManager } from "./universe-manager";
export { PROMPT as kbAgentPrompt } from "./agents/kb-agent";
export { ENTITIES_SCHEMA_URL, EVIDENCE_INSTRUCTION } from "./utils/validate-entities";
