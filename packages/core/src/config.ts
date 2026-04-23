import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

export const kbConfigSchema = z
  .object({
    kbDir: z.string().min(1).default("./kb"),
  })
  .passthrough();

export type KbConfig = z.infer<typeof kbConfigSchema>;

const RELATIVE_CONFIG_PATH = join(".kb-agent", "kb.json");

export function getKbConfigPath(cwd: string = process.cwd()): string {
  return join(cwd, RELATIVE_CONFIG_PATH);
}

export function loadKbConfig(cwd: string = process.cwd()): KbConfig {
  const configPath = getKbConfigPath(cwd);

  if (!existsSync(configPath)) {
    return kbConfigSchema.parse({});
  }

  let parsed: unknown;

  try {
    const fileContents = readFileSync(configPath, "utf-8");
    parsed = JSON.parse(fileContents);
  } catch (error) {
    throw new Error(`Failed to read kb config at ${configPath}`, {
      cause: error,
    });
  }

  try {
    return kbConfigSchema.parse(parsed);
  } catch (error) {
    throw new Error(`Invalid kb config at ${configPath}`, {
      cause: error,
    });
  }
}
