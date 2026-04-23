import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import { getUserDataDir } from "./utils/get-user-data-dir";

const KB_DIR_NAME = "kb-agent";
const KB_CONFIG_FILE_NAME = "kb.config.json";
const UNIVERSE_NAME_REGEX = /^[A-Za-z_-]+$/;

export const kbConfigSchema = z.looseObject({
  universes: z
    .array(
      z
        .string()
        .min(1)
        .regex(
          UNIVERSE_NAME_REGEX,
          "Universe names must contain letters and may include '_' or '-'.",
        ),
    )
    .default([])
    .describe("List of individual knowledge base names."),
});

export type KbConfig = z.infer<typeof kbConfigSchema>;

export class UniverseManager {
  public readonly kbRootDir: string;
  public readonly kbConfigPath: string;
  public readonly config: KbConfig;

  public constructor() {
    this.kbRootDir = join(getUserDataDir(), KB_DIR_NAME);
    this.kbConfigPath = join(this.kbRootDir, KB_CONFIG_FILE_NAME);
    this.config = this.loadKbConfig();
    this.ensureUniverseDirectories();
  }

  private loadKbConfig(): KbConfig {
    mkdirSync(this.kbRootDir, { recursive: true });

    if (!existsSync(this.kbConfigPath)) {
      const initialConfig = kbConfigSchema.parse({});
      writeFileSync(
        this.kbConfigPath,
        `${JSON.stringify(initialConfig, null, 2)}\n`,
        "utf-8",
      );
      return initialConfig;
    }

    let parsed: unknown;

    try {
      const fileContents = readFileSync(this.kbConfigPath, "utf-8");
      parsed = JSON.parse(fileContents);
    } catch (error) {
      throw new Error(`Failed to read kb config at ${this.kbConfigPath}`, {
        cause: error,
      });
    }

    try {
      return kbConfigSchema.parse(parsed);
    } catch (error) {
      throw new Error(`Invalid kb config at ${this.kbConfigPath}`, {
        cause: error,
      });
    }
  }

  public ensureUniverseDirectories(): void {
    const kbRoot = resolve(this.kbRootDir);

    mkdirSync(kbRoot, { recursive: true });

    for (const universe of this.config.universes) {
      mkdirSync(resolve(kbRoot, universe), { recursive: true });
    }
  }

  public getKbConfig(): KbConfig {
    return this.config;
  }
}
