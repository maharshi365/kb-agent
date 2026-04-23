import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import { Universe } from "./universe";
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
  public readonly universes: Map<string, Universe>;

  public constructor() {
    this.kbRootDir = join(getUserDataDir(), KB_DIR_NAME);
    this.kbConfigPath = join(this.kbRootDir, KB_CONFIG_FILE_NAME);
    this.config = this.loadKbConfig();
    this.universes = this.loadUniverses();
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

  private loadUniverses(): Map<string, Universe> {
    const kbRoot = resolve(this.kbRootDir);

    mkdirSync(kbRoot, { recursive: true });

    return new Map(
      this.config.universes.map((universeName) => [
        universeName,
        new Universe(universeName, kbRoot),
      ]),
    );
  }

  private saveKbConfig(): void {
    writeFileSync(this.kbConfigPath, `${JSON.stringify(this.config, null, 2)}\n`, "utf-8");
  }

  private validateUniverseName(name: string): void {
    if (!UNIVERSE_NAME_REGEX.test(name)) {
      throw new Error(
        "Universe names must contain letters and may include '_' or '-'.",
      );
    }
  }

  public getKbConfig(): KbConfig {
    return this.config;
  }

  public getUniverse(name: string): Universe | undefined {
    return this.universes.get(name);
  }

  public getUniverses(): Universe[] {
    return [...this.universes.values()];
  }

  public createUniverse(name: string): Universe {
    this.validateUniverseName(name);

    const existingUniverse = this.getUniverse(name);
    if (existingUniverse) {
      throw new Error(`Universe '${name}' already exists.`);
    }

    const universe = new Universe(name, resolve(this.kbRootDir));
    this.universes.set(name, universe);
    this.config.universes.push(name);
    this.saveKbConfig();

    return universe;
  }

  public deleteUniverse(name: string): boolean {
    const universe = this.universes.get(name);
    if (!universe) {
      return false;
    }

    universe.delete();
    this.universes.delete(name);
    this.config.universes = this.config.universes.filter(
      (universeName) => universeName !== name,
    );
    this.saveKbConfig();

    return true;
  }
}
