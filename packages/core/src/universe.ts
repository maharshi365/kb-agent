import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  ENTITIES_SCHEMA_URL,
  entitiesFileZodSchema,
  type EntitiesFile,
  type UniverseEntity,
  validateEntitiesFile,
} from "./utils/validate-entities";

export type { UniverseEntity } from "./utils/validate-entities";

const REQUIRED_UNIVERSE_DIRS = ["_meta", "_inbox", "_raw", "_data"] as const;
const META_DIR_NAME = "_meta";
const ENTITIES_FILE_NAME = "entities.json";

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

    this.ensureMetaFiles();
  }

  public delete(): void {
    rmSync(this.dir, { recursive: true, force: true });
  }

  public addEntity(entity: UniverseEntity): UniverseEntity {
    const entitiesFile = this.readEntitiesFile();
    const existing = entitiesFile.value.find((item) => item.name === entity.name);
    if (existing) {
      throw new Error(
        `Entity '${entity.name}' already exists in universe '${this.name}'.`,
      );
    }

    const nextEntitiesFile = entitiesFileZodSchema.parse({
      ...entitiesFile,
      value: [...entitiesFile.value, entity],
    });

    this.writeEntitiesFile(nextEntitiesFile);

    return nextEntitiesFile.value[nextEntitiesFile.value.length - 1];
  }

  public updateEntity(name: string, updates: Partial<UniverseEntity>): UniverseEntity {
    const entitiesFile = this.readEntitiesFile();
    const entityIndex = entitiesFile.value.findIndex((item) => item.name === name);

    if (entityIndex === -1) {
      throw new Error(`Entity '${name}' does not exist in universe '${this.name}'.`);
    }

    const mergedEntity = {
      ...entitiesFile.value[entityIndex],
      ...updates,
    };

    const duplicateName = entitiesFile.value.some(
      (item, index) => index !== entityIndex && item.name === mergedEntity.name,
    );

    if (duplicateName) {
      throw new Error(
        `Entity '${mergedEntity.name}' already exists in universe '${this.name}'.`,
      );
    }

    const nextValue = [...entitiesFile.value];
    nextValue[entityIndex] = mergedEntity;

    const nextEntitiesFile = entitiesFileZodSchema.parse({
      ...entitiesFile,
      value: nextValue,
    });

    this.writeEntitiesFile(nextEntitiesFile);

    return nextEntitiesFile.value[entityIndex];
  }

  public getEntities(): UniverseEntity[] {
    return this.readEntitiesFile().value;
  }

  public setEntities(entities: UniverseEntity[]): UniverseEntity[] {
    const nextEntitiesFile = entitiesFileZodSchema.parse({
      schema: ENTITIES_SCHEMA_URL,
      value: entities,
    });

    this.writeEntitiesFile(nextEntitiesFile);
    return nextEntitiesFile.value;
  }

  public deleteEntity(name: string): boolean {
    const entitiesFile = this.readEntitiesFile();
    const nextValue = entitiesFile.value.filter((entity) => entity.name !== name);

    if (nextValue.length === entitiesFile.value.length) {
      return false;
    }

    const nextEntitiesFile = entitiesFileZodSchema.parse({
      ...entitiesFile,
      value: nextValue,
    });

    this.writeEntitiesFile(nextEntitiesFile);
    return true;
  }

  private ensureMetaFiles(): void {
    const metaDir = join(this.dir, META_DIR_NAME);
    const entitiesPath = join(metaDir, ENTITIES_FILE_NAME);

    if (!existsSync(entitiesPath)) {
      writeFileSync(
        entitiesPath,
        `${JSON.stringify({ schema: ENTITIES_SCHEMA_URL, value: [] }, null, 2)}\n`,
        "utf-8",
      );
    }
  }

  private readEntitiesFile(): EntitiesFile {
    const entitiesPath = join(this.dir, META_DIR_NAME, ENTITIES_FILE_NAME);
    return validateEntitiesFile(entitiesPath);
  }

  private writeEntitiesFile(entitiesFile: EntitiesFile): void {
    const entitiesPath = join(this.dir, META_DIR_NAME, ENTITIES_FILE_NAME);
    writeFileSync(
      entitiesPath,
      `${JSON.stringify(entitiesFile, null, 2)}\n`,
      "utf-8",
    );
  }
}
