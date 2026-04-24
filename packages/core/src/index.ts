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
export { PROMPT as kbResearcherPrompt } from "./agents/kb-researcher";
export { PROMPT as kbProcessorPrompt } from "./agents/kb-processor";
export { PROMPT as kbReviewerPrompt } from "./agents/kb-reviewer";
export { PROMPT as kbHealerPrompt } from "./agents/kb-healer";
export { PROMPT as kbAuditorPrompt } from "./agents/kb-auditor";
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
