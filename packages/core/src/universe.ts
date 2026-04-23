import { mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const REQUIRED_UNIVERSE_DIRS = ["_meta", "_inbox", "_raw", "_data"] as const;

export class Universe {
  public readonly name: string;
  public readonly dir: string;

  public constructor(name: string, kbRootDir: string) {
    this.name = name;
    this.dir = resolve(kbRootDir, name);
    this.ensureStructure();
  }

  public ensureStructure(): void {
    mkdirSync(this.dir, { recursive: true });

    for (const dirname of REQUIRED_UNIVERSE_DIRS) {
      mkdirSync(join(this.dir, dirname), { recursive: true });
    }
  }

  public delete(): void {
    rmSync(this.dir, { recursive: true, force: true });
  }
}
