import type { KbConfig } from "./universe-manager";
import { kbConfig, universeManager } from "./runtime";

export type CoreStatus = "ready" | "busy";

export { universeManager, kbConfig };

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
export {
  kbUniverseList,
  kbUniverseCreate,
  kbUniverseDelete,
  kbEntitiesGet,
  kbEntitiesSet,
  kbEntityDelete,
  kbIndex,
  kbSearchBatch,
  kbDoc,
} from "./tools/kb-tools";
