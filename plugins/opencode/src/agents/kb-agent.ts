import {
  kbAgentPrompt,
  kbAuditorPrompt,
  kbHealerPrompt,
  kbProcessorPrompt,
  kbResearcherPrompt,
  kbReviewerPrompt,
  universeManager,
} from "@kb/core";

export function buildKbAgentDef(): Record<string, unknown> {
  const kbRootDir = universeManager.kbRootDir.replace(/\\/g, "/").replace(/\/+$/, "");
  const kbRootDirWindows = kbRootDir.replace(/\//g, "\\");
  const kbPathRules = {
    [kbRootDir]: "allow",
    [`${kbRootDir}/*`]: "allow",
    [`${kbRootDir}/**`]: "allow",
    [kbRootDirWindows]: "allow",
    [`${kbRootDirWindows}\\*`]: "allow",
    [`${kbRootDirWindows}\\**`]: "allow",
  };

  return {
    description: "Primary KB orchestrator.",
    mode: "primary",
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
      read: kbPathRules,
      external_directory: kbPathRules,
      skill: {
        "internal-*": "allow",
      },
    },
    prompt: kbAgentPrompt,
  };
}

function buildKbSubagentDef(prompt: string, description: string): Record<string, unknown> {
  const kbRootDir = universeManager.kbRootDir.replace(/\\/g, "/").replace(/\/+$/, "");
  const kbRootDirWindows = kbRootDir.replace(/\//g, "\\");
  const kbPathRules = {
    [kbRootDir]: "allow",
    [`${kbRootDir}/*`]: "allow",
    [`${kbRootDir}/**`]: "allow",
    [kbRootDirWindows]: "allow",
    [`${kbRootDirWindows}\\*`]: "allow",
    [`${kbRootDirWindows}\\**`]: "allow",
  };

  return {
    description,
    mode: "subagent",
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
      read: kbPathRules,
      external_directory: kbPathRules,
      bash: "deny",
      edit: "deny",
      write: "deny",
      skill: {
        "internal-*": "allow",
      },
    },
    prompt,
  };
}

export function buildKbResearcherDef(): Record<string, unknown> {
  return buildKbSubagentDef(kbResearcherPrompt, "KB question-answering researcher.");
}

export function buildKbProcessorDef(): Record<string, unknown> {
  return buildKbSubagentDef(kbProcessorPrompt, "KB ingestion processor for one source file.");
}

export function buildKbReviewerDef(): Record<string, unknown> {
  return buildKbSubagentDef(kbReviewerPrompt, "KB run-local reviewer and fixer.");
}

export function buildKbHealerDef(): Record<string, unknown> {
  return buildKbSubagentDef(kbHealerPrompt, "KB global integrity healer.");
}

export function buildKbAuditorDef(): Record<string, unknown> {
  return buildKbSubagentDef(kbAuditorPrompt, "KB factual quality auditor.");
}
