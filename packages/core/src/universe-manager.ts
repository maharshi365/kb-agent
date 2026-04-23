import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { KbConfig } from "./config";

export class UniverseManager {
  public readonly config: KbConfig;

  public constructor(config: KbConfig) {
    this.config = config;
    this.ensureUniverseDirectories();
  }

  public ensureUniverseDirectories(): void {
    const kbRoot = resolve(this.config.kbDir);

    mkdirSync(kbRoot, { recursive: true });

    for (const universe of this.config.universes) {
      mkdirSync(resolve(kbRoot, universe), { recursive: true });
    }
  }
}
