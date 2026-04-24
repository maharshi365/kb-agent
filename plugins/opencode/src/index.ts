import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "@opencode-ai/plugin";
import { universeManager } from "@kb/core";
import {
  buildKbAgentDef,
  buildKbAuditorDef,
  buildKbHealerDef,
  buildKbProcessorDef,
  buildKbResearcherDef,
  buildKbReviewerDef,
} from "./agents/kb-agent";
import { kbManagementTools } from "./tools/kb-management";

type PluginConfig = {
  permission?: Record<string, unknown>;
  agent?: Record<string, unknown>;
  skills?: unknown;
};

const kbPermissionDefaults: Record<string, unknown> = {
  "kb_*": "deny",
};

function installBundledSkills(): string | null {
  const kbRootDir = universeManager.kbRootDir;
  const skillsTargetDir = join(kbRootDir, "SKILLS");
  const currentFileDir = dirname(fileURLToPath(import.meta.url));
  const candidateSources = [
    resolve(currentFileDir, "../../../../packages/core/src/skills"),
    resolve(currentFileDir, "../../../packages/core/src/skills"),
  ];
  const bundledSkillsSourceDir = candidateSources.find((candidate) => existsSync(candidate));

  mkdirSync(kbRootDir, { recursive: true });
  mkdirSync(skillsTargetDir, { recursive: true });

  if (!bundledSkillsSourceDir) {
    return null;
  }

  cpSync(bundledSkillsSourceDir, skillsTargetDir, {
    recursive: true,
    force: true,
  });

  return skillsTargetDir;
}

function withSkillPath(existing: unknown, skillsPath: string): unknown {
  if (Array.isArray(existing)) {
    const paths = [...new Set([...existing, skillsPath])];
    return paths;
  }

  if (existing && typeof existing === "object") {
    const existingObject = existing as Record<string, unknown>;
    const existingPaths = Array.isArray(existingObject.paths)
      ? existingObject.paths.filter((value): value is string => typeof value === "string")
      : [];

    return {
      ...existingObject,
      paths: [...new Set([...existingPaths, skillsPath])],
    };
  }

  return {
    paths: [skillsPath],
  };
}

const server: Plugin = async () => {
  return {
    config: async (config: PluginConfig) => {
      const installedSkillsPath = installBundledSkills();

      config.permission = {
        ...(config.permission ?? {}),
        ...kbPermissionDefaults,
      };

      if (installedSkillsPath) {
        config.skills = withSkillPath(config.skills, installedSkillsPath);
      }

      const agentDefs = config.agent ?? {};

      agentDefs["kb-agent"] = buildKbAgentDef();
      agentDefs["kb-researcher"] = buildKbResearcherDef();
      agentDefs["kb-processor"] = buildKbProcessorDef();
      agentDefs["kb-reviewer"] = buildKbReviewerDef();
      agentDefs["kb-healer"] = buildKbHealerDef();
      agentDefs["kb-auditor"] = buildKbAuditorDef();
      config.agent = agentDefs;
    },
    tool: kbManagementTools,
  };
};

export default {
  id: "@kb/plugin-opencode",
  server,
};
