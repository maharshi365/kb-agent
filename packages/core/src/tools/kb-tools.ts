import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { ENTITIES_SCHEMA_URL } from "../utils/validate-entities";
import { universeManager } from "../runtime";

type ValidationIssue = {
  field: string;
  message: string;
  severity: "error" | "warning";
};

type ManifestEntry = {
  name: string;
  entityType: string;
  path: string;
  aliases: string[];
  sources: string[];
};

type Manifest = {
  universe: string;
  total: number;
  byType: Record<string, number>;
  entities: ManifestEntry[];
  lastUpdated: string;
};

type ParsedEntity = {
  entityType: string;
  name: string;
  aliases: string[];
  sources: string[];
  related: Record<string, string[]>;
  created: string;
  updated: string;
};

type IndexedPage = {
  name: string;
  nameKey: string;
  entityType: string;
  path: string;
  links: string[];
};

type BodySignals = {
  hasOverviewHeading: boolean;
  hasEvidenceHeading: boolean;
  hasRelationshipsHeading: boolean;
  hasSourceBlock: boolean;
  hasWikilink: boolean;
};

const MIN_ENTITY_BODY_CHARS = 40;

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function getUniverseOrMessage(name: string) {
  const universe = universeManager.getUniverse(name);
  if (!universe) {
    return `Universe '${name}' does not exist.`;
  }

  return universe;
}

function splitFrontmatter(content: string): { frontmatter: string; body: string } | null {
  if (!content.startsWith("---\n")) {
    return null;
  }

  const end = content.indexOf("\n---\n", 4);
  if (end === -1) {
    return null;
  }

  return {
    frontmatter: content.slice(4, end),
    body: content.slice(end + 5),
  };
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseScalar(frontmatter: string, key: string): string | null {
  const regex = new RegExp(`^${key}:\\s*(.+)$`, "m");
  const match = frontmatter.match(regex);
  if (!match) {
    return null;
  }

  return unquote(match[1]);
}

function parseArray(frontmatter: string, key: string): string[] {
  const lines = frontmatter.split(/\r?\n/);
  const keyIndex = lines.findIndex((line) => line.startsWith(`${key}:`));
  if (keyIndex === -1) {
    return [];
  }

  const firstLine = lines[keyIndex] ?? "";
  const inline = firstLine.slice(key.length + 1).trim();
  if (inline === "[]") {
    return [];
  }

  const values: string[] = [];
  for (let i = keyIndex + 1; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (!line.startsWith("  ")) {
      break;
    }

    const itemMatch = line.match(/^\s*-\s+(.+)$/);
    if (itemMatch) {
      values.push(unquote(itemMatch[1]));
    }
  }

  return values;
}

function parseRelated(frontmatter: string): Record<string, string[]> {
  const lines = frontmatter.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith("related:"));
  if (start === -1) {
    return {};
  }

  const related: Record<string, string[]> = {};

  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (!line.startsWith("  ")) {
      break;
    }

    const keyMatch = line.match(/^\s{2}([^:]+):\s*(.*)$/);
    if (!keyMatch) {
      continue;
    }

    const relatedType = keyMatch[1].trim();
    const values: string[] = [];

    for (let j = i + 1; j < lines.length; j += 1) {
      const nestedLine = lines[j] ?? "";
      if (!nestedLine.startsWith("    ")) {
        break;
      }

      const itemMatch = nestedLine.match(/^\s*-\s+(.+)$/);
      if (itemMatch) {
        values.push(unquote(itemMatch[1]));
      }

      i = j;
    }

    related[relatedType] = values;
  }

  return related;
}

function parseEntityFrontmatter(content: string): ParsedEntity | null {
  const split = splitFrontmatter(content);
  if (!split) {
    return null;
  }

  return {
    entityType: parseScalar(split.frontmatter, "entityType") ?? "",
    name: parseScalar(split.frontmatter, "name") ?? "",
    aliases: parseArray(split.frontmatter, "aliases"),
    sources: parseArray(split.frontmatter, "sources"),
    related: parseRelated(split.frontmatter),
    created: parseScalar(split.frontmatter, "created") ?? today(),
    updated: parseScalar(split.frontmatter, "updated") ?? today(),
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function renderArray(key: string, values: string[]): string {
  if (values.length === 0) {
    return `${key}: []`;
  }

  return `${key}:\n${values.map((value) => `  - "${value.replace(/"/g, '\\\"')}"`).join("\n")}`;
}

function renderRelated(related: Record<string, string[]>): string {
  const keys = Object.keys(related).sort((a, b) => a.localeCompare(b));
  if (keys.length === 0) {
    return "related: {}";
  }

  const lines = ["related:"];
  for (const key of keys) {
    const values = unique(related[key] ?? []);
    if (values.length === 0) {
      lines.push(`  ${key}: []`);
      continue;
    }

    lines.push(`  ${key}:`);
    for (const value of values) {
      lines.push(`    - "${value.replace(/"/g, '\\\"')}"`);
    }
  }

  return lines.join("\n");
}

function renderEntityFrontmatter(entity: ParsedEntity): string {
  return [
    "---",
    `entityType: ${entity.entityType}`,
    `name: "${entity.name.replace(/"/g, '\\\"')}"`,
    renderArray("aliases", unique(entity.aliases)),
    renderArray("sources", unique(entity.sources)),
    renderRelated(entity.related),
    `created: "${entity.created}"`,
    `updated: "${entity.updated}"`,
    "---",
  ].join("\n");
}

function validateFrontmatter(
  entity: ParsedEntity,
  validTypes: Set<string>,
  validSources: Set<string>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!entity.entityType.trim()) {
    issues.push({ field: "entityType", message: "entityType is required", severity: "error" });
  } else if (!validTypes.has(entity.entityType)) {
    issues.push({
      field: "entityType",
      message: `entityType '${entity.entityType}' is not defined in _meta/entities.json`,
      severity: "error",
    });
  }

  if (!entity.name.trim()) {
    issues.push({ field: "name", message: "name is required", severity: "error" });
  }

  if (entity.sources.length === 0) {
    issues.push({ field: "sources", message: "sources must include at least one item", severity: "error" });
  }

  for (const source of entity.sources) {
    const normalizedSource = source.replace(/^["']+|["']+$/g, '');
    
    if (normalizedSource.includes("/") || normalizedSource.includes("\\")) {
      issues.push({ field: "sources", message: `Source '${source}' must be a flat filename, not a path.`, severity: "error" });
    } else if (!validSources.has(normalizedSource)) {
      issues.push({ field: "sources", message: `Source '${source}' does not exist in the _raw directory. Valid sources are raw file names.`, severity: "error" });
    }
  }

  for (const [relatedType, links] of Object.entries(entity.related)) {
    if (!validTypes.has(relatedType)) {
      issues.push({
        field: `related.${relatedType}`,
        message: `Unknown related type '${relatedType}'`,
        severity: "error",
      });
    }

    for (const link of links) {
      if (!/^\[\[[^\]]+\]\]$/.test(link.trim())) {
        issues.push({
          field: `related.${relatedType}`,
          message: `Invalid wikilink '${link}'. Expected [[Entity Name]].`,
          severity: "error",
        });
      }
    }
  }

  return issues;
}

function buildRequiredRelatedByType(
  entities: Array<{ name: string; requiredEntities?: string[] }>,
): Map<string, string[]> {
  const requiredMap = new Map<string, string[]>();

  for (const entity of entities) {
    requiredMap.set(entity.name, unique(entity.requiredEntities ?? []));
  }

  return requiredMap;
}

function validateRequiredRelationships(
  entity: ParsedEntity,
  requiredRelatedByType: Map<string, string[]>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const requiredTypes = requiredRelatedByType.get(entity.entityType) ?? [];

  for (const requiredType of requiredTypes) {
    const links = entity.related[requiredType] ?? [];
    if (links.length === 0) {
      issues.push({
        field: `related.${requiredType}`,
        message: `At least one relationship is required for '${requiredType}' by schema for entityType '${entity.entityType}'.`,
        severity: "error",
      });
    }
  }

  return issues;
}

function detectBodySignals(body: string): BodySignals {
  return {
    hasOverviewHeading: /(^|\n)##\s+Overview(\s|$)/i.test(body),
    hasEvidenceHeading: /(^|\n)##\s+Evidence(\s|$)/i.test(body),
    hasRelationshipsHeading: /(^|\n)##\s+Relationships(\s|$)/i.test(body),
    hasSourceBlock: /(^|\n)>\s*Source:/i.test(body),
    hasWikilink: /\[\[[^\]]+\]\]/.test(body),
  };
}

function validateEntityBody(
  body: string,
  options: { allowEmptyBody: boolean; minChars: number },
): { errors: ValidationIssue[]; signals: BodySignals; bodyChars: number } {
  const trimmed = body.trim();
  const signals = detectBodySignals(trimmed);
  const errors: ValidationIssue[] = [];

  if (trimmed.length === 0 && !options.allowEmptyBody) {
    errors.push({
      field: "body",
      message: "Entity body is required and cannot be empty",
      severity: "error",
    });
  }

  if (trimmed.length > 0 && trimmed.length < options.minChars && !options.allowEmptyBody) {
    errors.push({
      field: "body",
      message: `Entity body is too short (${trimmed.length} chars). Minimum is ${options.minChars}.`,
      severity: "error",
    });
  }

  if (
    trimmed.length > 0 &&
    !signals.hasOverviewHeading &&
    !signals.hasEvidenceHeading &&
    !signals.hasRelationshipsHeading &&
    !signals.hasSourceBlock &&
    !signals.hasWikilink &&
    !options.allowEmptyBody
  ) {
    errors.push({
      field: "body",
      message: "Entity body must contain meaningful structure (heading, evidence/source block, or wikilink).",
      severity: "error",
    });
  }

  return {
    errors,
    signals,
    bodyChars: trimmed.length,
  };
}

function getTypeDirectories(dataDir: string): string[] {
  if (!existsSync(dataDir)) {
    return [];
  }

  return readdirSync(dataDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function getEntityFiles(typeDir: string): string[] {
  if (!existsSync(typeDir)) {
    return [];
  }

  return readdirSync(typeDir)
    .filter((name) => name.endsWith(".md") && !name.startsWith("_"))
    .sort((a, b) => a.localeCompare(b));
}

function getManifestPath(dataDir: string): string {
  return join(dataDir, "_manifest.json");
}

function normalizeLinkTarget(rawTarget: string): string {
  const target = rawTarget.trim().split("|")[0]?.split("#")[0]?.trim() ?? "";
  return target;
}

function extractWikilinkTargets(content: string): string[] {
  const matches = content.matchAll(/\[\[([^\]]+)\]\]/g);
  const targets = Array.from(matches)
    .map((match) => normalizeLinkTarget(match[1] ?? ""))
    .filter(Boolean);
  return unique(targets);
}

function collectPageLinks(raw: string, parsed: ParsedEntity | null): string[] {
  const split = splitFrontmatter(raw);
  const bodyLinks = extractWikilinkTargets(split?.body ?? raw);
  const relatedLinks = Object.values(parsed?.related ?? {})
    .flat()
    .flatMap((value) => extractWikilinkTargets(value));
  return unique([...bodyLinks, ...relatedLinks]);
}

function collectIndexedPages(universeDir: string): IndexedPage[] {
  const dataDir = join(universeDir, "_data");
  const pages: IndexedPage[] = [];

  for (const entityType of getTypeDirectories(dataDir)) {
    const typeDir = join(dataDir, entityType);
    for (const fileName of getEntityFiles(typeDir)) {
      const absoluteFilePath = join(typeDir, fileName);
      const raw = readFileSync(absoluteFilePath, "utf-8");
      const parsed = parseEntityFrontmatter(raw);
      const name = parsed?.name?.trim() || basename(fileName, ".md");
      const links = collectPageLinks(raw, parsed);

      pages.push({
        name,
        nameKey: name.toLowerCase(),
        entityType,
        path: relative(universeDir, absoluteFilePath).replace(/\\/g, "/"),
        links,
      });
    }
  }

  return pages;
}

function normalizeLimit(limit?: number): number {
  if (!Number.isFinite(limit)) {
    return 25;
  }

  return Math.max(1, Math.min(200, Math.floor(limit ?? 25)));
}

function buildManifest(universeName: string, universeDir: string): Manifest {
  const dataDir = join(universeDir, "_data");
  const byType: Record<string, number> = {};
  const entities: ManifestEntry[] = [];

  for (const entityType of getTypeDirectories(dataDir)) {
    const typeDir = join(dataDir, entityType);
    const files = getEntityFiles(typeDir);
    byType[entityType] = files.length;

    for (const fileName of files) {
      const absoluteFilePath = join(typeDir, fileName);
      const raw = readFileSync(absoluteFilePath, "utf-8");
      const parsed = parseEntityFrontmatter(raw);
      const fallbackName = basename(fileName, ".md");

      entities.push({
        name: parsed?.name ?? fallbackName,
        entityType,
        path: relative(universeDir, absoluteFilePath).replace(/\\/g, "/"),
        aliases: parsed?.aliases ?? [],
        sources: parsed?.sources ?? [],
      });
    }
  }

  return {
    universe: universeName,
    total: entities.length,
    byType,
    entities,
    lastUpdated: new Date().toISOString(),
  };
}

function isManifestFresh(universeDir: string): boolean {
  const dataDir = join(universeDir, "_data");
  const manifestPath = getManifestPath(dataDir);

  if (!existsSync(manifestPath)) {
    return false;
  }

  const manifestMtime = statSync(manifestPath).mtimeMs;
  for (const entityType of getTypeDirectories(dataDir)) {
    for (const fileName of getEntityFiles(join(dataDir, entityType))) {
      if (statSync(join(dataDir, entityType, fileName)).mtimeMs > manifestMtime) {
        return false;
      }
    }
  }

  return true;
}

function getOrBuildManifest(universeName: string, universeDir: string): Manifest {
  const dataDir = join(universeDir, "_data");
  const manifestPath = getManifestPath(dataDir);

  if (isManifestFresh(universeDir)) {
    try {
      return JSON.parse(readFileSync(manifestPath, "utf-8")) as Manifest;
    } catch {
      // Rebuild on parse failure.
    }
  }

  const manifest = buildManifest(universeName, universeDir);
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
  return manifest;
}

function fuzzyScore(query: string, candidate: string): number {
  const a = query.toLowerCase().trim();
  const b = candidate.toLowerCase().trim();
  if (!a || !b) {
    return 0;
  }

  if (a === b) {
    return 1;
  }

  if (a.includes(b) || b.includes(a)) {
    return 0.7;
  }

  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return (2 * dp[m][n]) / (m + n);
}

function safeUniversePath(universeDir: string, inputPath: string): string | null {
  const abs = resolve(universeDir, inputPath);
  const root = resolve(universeDir);
  if (!abs.startsWith(root)) {
    return null;
  }

  return abs;
}

export function kbUniverseList(): string {
  const universes = universeManager.getUniverses().map((universe) => universe.name);
  if (universes.length === 0) {
    return "No universes found.";
  }

  return `Universes:\n${universes.map((name) => `- ${name}`).join("\n")}`;
}

export function kbUniverseCreate(name: string): string {
  const universeName = name.trim();
  if (!universeName) {
    return "Missing universe name.";
  }

  universeManager.createUniverse(universeName);
  return `Created universe '${universeName}'.`;
}

export function kbUniverseDelete(name: string): string {
  const universeName = name.trim();
  if (!universeName) {
    return "Missing universe name.";
  }

  const deleted = universeManager.deleteUniverse(universeName);
  if (!deleted) {
    return `Universe '${universeName}' does not exist.`;
  }

  return `Deleted universe '${universeName}'.`;
}

export function kbEntitiesGet(universe: string): string {
  const universeName = universe.trim();
  if (!universeName) {
    return "Missing universe name.";
  }

  const universeOrMessage = getUniverseOrMessage(universeName);
  if (typeof universeOrMessage === "string") {
    return universeOrMessage;
  }

  return JSON.stringify(
    {
      schema: ENTITIES_SCHEMA_URL,
      value: universeOrMessage.getEntities(),
    },
    null,
    2,
  );
}

export function kbEntitiesSet(universe: string, entitiesJson: string): string {
  const universeName = universe.trim();
  if (!universeName) {
    return "Missing universe name.";
  }

  const universeOrMessage = getUniverseOrMessage(universeName);
  if (typeof universeOrMessage === "string") {
    return universeOrMessage;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(entitiesJson);
  } catch {
    return "entitiesJson must be valid JSON.";
  }

  const nextEntities =
    parsed && typeof parsed === "object" && "value" in parsed
      ? (parsed as { value: unknown }).value
      : parsed;

  if (!Array.isArray(nextEntities)) {
    return "entitiesJson must be an array of entities or an object with a 'value' array.";
  }

  universeOrMessage.setEntities(nextEntities);
  return `Updated entities for '${universeName}' (${nextEntities.length} entries).`;
}

export function kbEntityDelete(universe: string, name: string): string {
  const universeName = universe.trim();
  const entityName = name.trim();
  if (!universeName) {
    return "Missing universe name.";
  }

  if (!entityName) {
    return "Missing entity name.";
  }

  const universeOrMessage = getUniverseOrMessage(universeName);
  if (typeof universeOrMessage === "string") {
    return universeOrMessage;
  }

  const deleted = universeOrMessage.deleteEntity(entityName);
  if (!deleted) {
    return `Entity '${entityName}' does not exist in universe '${universeName}'.`;
  }

  return `Deleted entity '${entityName}' from universe '${universeName}'.`;
}

export function kbIndex(args: {
  universe: string;
  action: "list" | "stats" | "rebuild" | "duplicates" | "dead-links" | "orphaned-pages";
  type?: string;
  limit?: number;
}): string {
  const universeName = args.universe.trim();
  if (!universeName) {
    return "Missing universe name.";
  }

  const universeOrMessage = getUniverseOrMessage(universeName);
  if (typeof universeOrMessage === "string") {
    return universeOrMessage;
  }

  const manifest =
    args.action === "rebuild"
      ? (() => {
          const built = buildManifest(universeOrMessage.name, universeOrMessage.dir);
          const dataDir = join(universeOrMessage.dir, "_data");
          mkdirSync(dataDir, { recursive: true });
          writeFileSync(getManifestPath(dataDir), `${JSON.stringify(built, null, 2)}\n`, "utf-8");
          return built;
        })()
      : getOrBuildManifest(universeOrMessage.name, universeOrMessage.dir);

  if (args.action === "duplicates" || args.action === "dead-links" || args.action === "orphaned-pages") {
    const pages = collectIndexedPages(universeOrMessage.dir);
    const limited = normalizeLimit(args.limit);

    if (args.action === "duplicates") {
      const grouped = new Map<string, IndexedPage[]>();
      for (const page of pages) {
        const group = grouped.get(page.nameKey) ?? [];
        group.push(page);
        grouped.set(page.nameKey, group);
      }

      const allIssues = Array.from(grouped.entries())
        .filter(([, entries]) => entries.length > 1)
        .map(([, entries]) => ({
          name: entries[0].name,
          count: entries.length,
          paths: entries.map((entry) => entry.path).sort((a, b) => a.localeCompare(b)),
        }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

      const issues = allIssues.slice(0, limited);
      return JSON.stringify(
        {
          action: "duplicates",
          universe: universeName,
          scannedPages: pages.length,
          totalIssues: allIssues.length,
          returned: issues.length,
          limit: limited,
          truncated: allIssues.length > issues.length,
          issues,
        },
        null,
        2,
      );
    }

    const pagesByName = new Set(pages.map((page) => page.nameKey));
    const inboundCounts = new Map<string, number>();
    for (const page of pages) {
      inboundCounts.set(page.path, 0);
    }

    for (const page of pages) {
      for (const rawTarget of page.links) {
        const targetKey = rawTarget.toLowerCase();
        if (!pagesByName.has(targetKey)) {
          continue;
        }

        for (const targetPage of pages) {
          if (targetPage.nameKey !== targetKey) {
            continue;
          }

          inboundCounts.set(targetPage.path, (inboundCounts.get(targetPage.path) ?? 0) + 1);
        }
      }
    }

    if (args.action === "dead-links") {
      const allIssues = pages
        .flatMap((page) =>
          page.links
            .filter((target) => !pagesByName.has(target.toLowerCase()))
            .map((target) => ({
              sourceName: page.name,
              sourcePath: page.path,
              target,
            })),
        )
        .sort(
          (a, b) =>
            a.sourcePath.localeCompare(b.sourcePath) ||
            a.target.localeCompare(b.target),
        );

      const issues = allIssues.slice(0, limited);
      return JSON.stringify(
        {
          action: "dead-links",
          universe: universeName,
          scannedPages: pages.length,
          totalIssues: allIssues.length,
          returned: issues.length,
          limit: limited,
          truncated: allIssues.length > issues.length,
          issues,
        },
        null,
        2,
      );
    }

    const allIssues = pages
      .filter((page) => (inboundCounts.get(page.path) ?? 0) === 0 && page.links.length === 0)
      .map((page) => ({
        name: page.name,
        entityType: page.entityType,
        path: page.path,
      }))
      .sort((a, b) => a.path.localeCompare(b.path));

    const issues = allIssues.slice(0, limited);
    return JSON.stringify(
      {
        action: "orphaned-pages",
        universe: universeName,
        scannedPages: pages.length,
        totalIssues: allIssues.length,
        returned: issues.length,
        limit: limited,
        truncated: allIssues.length > issues.length,
        issues,
      },
      null,
      2,
    );
  }

  if (args.action === "stats") {
    const sourceSet = new Set<string>();
    for (const entity of manifest.entities) {
      for (const source of entity.sources) {
        sourceSet.add(source);
      }
    }

    return JSON.stringify(
      {
        action: "stats",
        universe: universeName,
        total: manifest.total,
        byType: manifest.byType,
        sourcesCovered: [...sourceSet],
        lastUpdated: manifest.lastUpdated,
      },
      null,
      2,
    );
  }

  if (args.action === "rebuild") {
    return JSON.stringify(
      {
        action: "rebuild",
        universe: universeName,
        total: manifest.total,
        byType: manifest.byType,
        lastUpdated: manifest.lastUpdated,
        message: `Manifest rebuilt (${manifest.total} entities).`,
      },
      null,
      2,
    );
  }

  const grouped: Record<string, string[]> = {};
  for (const entity of manifest.entities) {
    if (args.type && entity.entityType !== args.type) {
      continue;
    }

    if (!grouped[entity.entityType]) {
      grouped[entity.entityType] = [];
    }

    grouped[entity.entityType].push(entity.name);
  }

  for (const key of Object.keys(grouped)) {
    grouped[key] = grouped[key].sort((a, b) => a.localeCompare(b));
  }

  const total = Object.values(grouped).reduce((sum, names) => sum + names.length, 0);
  return JSON.stringify(
    {
      action: "list",
      universe: universeName,
      total,
      entities: grouped,
    },
    null,
    2,
  );
}

export function kbSearchBatch(args: { universe: string; queries: string; fuzzy?: boolean }): string {
  const universeName = args.universe.trim();
  if (!universeName) {
    return "Missing universe name.";
  }

  const universeOrMessage = getUniverseOrMessage(universeName);
  if (typeof universeOrMessage === "string") {
    return universeOrMessage;
  }

  let parsedQueries: Array<{ query: string; type?: string }>;
  try {
    parsedQueries = JSON.parse(args.queries);
  } catch {
    return JSON.stringify({ success: false, error: "queries must be valid JSON" }, null, 2);
  }

  if (!Array.isArray(parsedQueries)) {
    return JSON.stringify({ success: false, error: "queries must be a JSON array" }, null, 2);
  }

  const manifest = getOrBuildManifest(universeName, universeOrMessage.dir);
  const allowFuzzy = args.fuzzy !== false;

  const results = parsedQueries.map((item) => {
    const query = (item.query ?? "").trim();
    const queryLower = query.toLowerCase();
    const pool = item.type
      ? manifest.entities.filter((entity) => entity.entityType === item.type)
      : manifest.entities;

    const matches = pool
      .map((entity) => {
        if (!query) {
          return null;
        }

        if (entity.name === query) {
          return { ...entity, score: 1, matchType: "exact" as const };
        }

        if (entity.aliases.includes(query)) {
          return { ...entity, score: 0.95, matchType: "alias" as const };
        }

        if (entity.name.toLowerCase() === queryLower) {
          return { ...entity, score: 0.9, matchType: "case-insensitive" as const };
        }

        if (entity.aliases.some((alias) => alias.toLowerCase() === queryLower)) {
          return { ...entity, score: 0.85, matchType: "alias" as const };
        }

        if (!allowFuzzy) {
          return null;
        }

        const nameScore = fuzzyScore(query, entity.name);
        const aliasScore = entity.aliases.reduce(
          (best, alias) => Math.max(best, fuzzyScore(query, alias)),
          0,
        );
        const score = Math.max(nameScore, aliasScore);
        if (score < 0.5) {
          return null;
        }

        return {
          ...entity,
          score: Number(score.toFixed(3)),
          matchType: "fuzzy" as const,
        };
      })
      .filter((value): value is NonNullable<typeof value> => value !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((entry) => ({
        name: entry.name,
        path: entry.path,
        entityType: entry.entityType,
        matchType: entry.matchType,
        score: entry.score,
      }));

    return {
      query,
      type: item.type,
      found: matches.length > 0,
      matches,
    };
  });

  return JSON.stringify(
    {
      success: true,
      universe: universeName,
      totalQueries: results.length,
      totalFound: results.filter((result) => result.found).length,
      results,
    },
    null,
    2,
  );
}

type KbDocActionArgs = {
  universe: string;
  action: "upsert-entity" | "write-entity" | "regenerate-index" | "verify" | "merge-entities";
  upsertData?: string;
  entityData?: string;
  path?: string;
  sourcePath?: string;
  targetPath?: string;
};

export function kbEntityUpsert(args: { universe: string; upsertData: string }): string {
  return runKbDocAction({
    universe: args.universe,
    action: "upsert-entity",
    upsertData: args.upsertData,
  });
}

export function kbEntityWrite(args: { universe: string; entityData: string }): string {
  return runKbDocAction({
    universe: args.universe,
    action: "write-entity",
    entityData: args.entityData,
  });
}

export function kbEntityMerge(args: { universe: string; sourcePath: string; targetPath: string }): string {
  return runKbDocAction({
    universe: args.universe,
    action: "merge-entities",
    sourcePath: args.sourcePath,
    targetPath: args.targetPath,
  });
}

export function kbIndexRegenerate(args: { universe: string; path?: string }): string {
  return runKbDocAction({
    universe: args.universe,
    action: "regenerate-index",
    path: args.path,
  });
}

export function kbVerify(args: { universe: string; path?: string }): string {
  return runKbDocAction({
    universe: args.universe,
    action: "verify",
    path: args.path,
  });
}

function runKbDocAction(args: KbDocActionArgs): string {
  const universeName = args.universe.trim();
  if (!universeName) {
    return "Missing universe name.";
  }

  const universeOrMessage = getUniverseOrMessage(universeName);
  if (typeof universeOrMessage === "string") {
    return universeOrMessage;
  }

  const universeEntities = universeOrMessage.getEntities();
  const validTypes = new Set(universeEntities.map((entity) => entity.name));
  const requiredRelatedByType = buildRequiredRelatedByType(universeEntities);
  const dataDir = join(universeOrMessage.dir, "_data");

  const rawDir = join(universeOrMessage.dir, "_raw");
  const validSources = new Set<string>();
  if (existsSync(rawDir)) {
    for (const name of readdirSync(rawDir)) {
      validSources.add(name);
    }
  }

  if (args.action === "merge-entities") {
    if (!args.sourcePath || !args.targetPath) {
      return JSON.stringify({ success: false, code: "E_MERGE_ARGS", error: "sourcePath and targetPath are required for merge-entities" }, null, 2);
    }

    const sourceAbs = safeUniversePath(universeOrMessage.dir, args.sourcePath);
    const targetAbs = safeUniversePath(universeOrMessage.dir, args.targetPath);

    if (!sourceAbs || !targetAbs) {
      return JSON.stringify({ success: false, code: "E_MERGE_PATHS", error: "Invalid source or target paths" }, null, 2);
    }

    if (sourceAbs === targetAbs) {
      return JSON.stringify({ success: false, code: "E_MERGE_SAME", error: "Source and target cannot be the same file" }, null, 2);
    }

    if (!existsSync(sourceAbs)) {
      return JSON.stringify({ success: false, code: "E_MERGE_SOURCE_MISSING", error: "Source file not found: " + args.sourcePath }, null, 2);
    }
    if (!existsSync(targetAbs)) {
      return JSON.stringify({ success: false, code: "E_MERGE_TARGET_MISSING", error: "Target file not found: " + args.targetPath }, null, 2);
    }

    const sourceRaw = readFileSync(sourceAbs, "utf-8");
    const sourceParsed = parseEntityFrontmatter(sourceRaw);
    const sourceSplit = splitFrontmatter(sourceRaw);

    const targetRaw = readFileSync(targetAbs, "utf-8");
    const targetParsed = parseEntityFrontmatter(targetRaw);
    const targetSplit = splitFrontmatter(targetRaw);

    if (!sourceParsed || !sourceSplit || !targetParsed || !targetSplit) {
      return JSON.stringify({ success: false, code: "E_MERGE_PARSE", error: "Could not parse source or target files" }, null, 2);
    }

    const oldName = sourceParsed.name;
    const newName = targetParsed.name;

    // 1. Merge frontmatter
    targetParsed.aliases = unique([...targetParsed.aliases, ...sourceParsed.aliases, oldName].filter(a => a !== newName));
    targetParsed.sources = unique([...targetParsed.sources, ...sourceParsed.sources]);
    for (const [rType, rLinks] of Object.entries(sourceParsed.related)) {
      targetParsed.related[rType] = unique([...(targetParsed.related[rType] ?? []), ...rLinks]);
    }

    // Remove self-references
    for (const rType of Object.keys(targetParsed.related)) {
      targetParsed.related[rType] = targetParsed.related[rType].filter(
         link => link !== `[[${newName}]]` && !link.startsWith(`[[${newName}|`)
      );
      if (targetParsed.related[rType].length === 0) delete targetParsed.related[rType];
    }
    targetParsed.updated = today();

    // 2. Validate Target Frontmatter
    const issues = [
      ...validateFrontmatter(targetParsed, validTypes, validSources),
      ...validateRequiredRelationships(targetParsed, requiredRelatedByType),
    ];

    if (issues.some(i => i.severity === "error")) {
       return JSON.stringify({ success: false, code: "E_MERGE_VALIDATION", error: "Merged frontmatter is invalid", errors: issues }, null, 2);
    }

    // 3. Blind Combine Body
    const combinedBody = targetSplit.body.trimEnd() +
      `\n\n## [Merged Content from ${oldName}]\n\n` +
      sourceSplit.body.trim();

    const mergedContent = `${renderEntityFrontmatter(targetParsed)}\n${combinedBody}\n`;
    writeFileSync(targetAbs, mergedContent, "utf-8");

    // 4. Rewrite References
    let referencesRewritten = 0;
    const linkRegex = new RegExp(`\\[\\[${escapeRegExp(oldName)}(\\|[^\\]]+)?\\]\\]`, "g");

    for (const entityType of getTypeDirectories(dataDir)) {
      const typeDir = join(dataDir, entityType);
      for (const fileName of getEntityFiles(typeDir)) {
         const filePath = join(typeDir, fileName);
         if (filePath === sourceAbs || filePath === targetAbs) continue;

         const raw = readFileSync(filePath, "utf-8");
         if (!raw.includes(oldName)) continue;

         let changed = false;
         const newRaw = raw.replace(linkRegex, (match, alias) => {
            changed = true;
            return `[[${newName}${alias || ""}]]`;
         });

         if (changed) {
            writeFileSync(filePath, newRaw, "utf-8");
            referencesRewritten++;
         }
      }
    }

    // 5. Delete Source (always)
    rmSync(sourceAbs, { force: true });

    return JSON.stringify({
       success: true,
       action: "merge-entities",
       message: `Merged ${oldName} into ${newName}. Rewrote ${referencesRewritten} files.`,
       warning: "Blind combine completed. Deduplication was NOT performed. Please review the newly merged file via 'read' and clean up duplicate sections/evidence via 'write-entity'.",
       referencesRewritten
    }, null, 2);
  }

  if (args.action === "upsert-entity") {
    if (!args.upsertData) {
      return JSON.stringify({ success: false, error: "upsertData is required" }, null, 2);
    }

    let upsert: {
      entityType: string;
      name: string;
      aliases?: string[];
      newSource: string;
      newEvidence: string;
      newRelated?: Record<string, string[]>;
      overviewAddition?: string;
    };

    try {
      upsert = JSON.parse(args.upsertData);
    } catch {
      return JSON.stringify({ success: false, error: "upsertData must be valid JSON" }, null, 2);
    }

    if (!upsert.entityType || !upsert.name || !upsert.newSource || !upsert.newEvidence) {
      return JSON.stringify(
        {
          success: false,
          error: "upsertData must include entityType, name, newSource, and newEvidence",
        },
        null,
        2,
      );
    }

    const entityDir = join(dataDir, upsert.entityType);
    const entityPath = join(entityDir, `${upsert.name}.md`);
    const exists = existsSync(entityPath);

    let frontmatter: ParsedEntity;
    let body = "";

    if (exists) {
      const raw = readFileSync(entityPath, "utf-8");
      const parsed = parseEntityFrontmatter(raw);
      const split = splitFrontmatter(raw);

      if (!parsed || !split) {
        return JSON.stringify(
          {
            success: false,
            error: `Failed to parse existing entity file: ${relative(universeOrMessage.dir, entityPath)}`,
          },
          null,
          2,
        );
      }

      frontmatter = parsed;
      body = split.body;
    } else {
      frontmatter = {
        entityType: upsert.entityType,
        name: upsert.name,
        aliases: [],
        sources: [],
        related: {},
        created: today(),
        updated: today(),
      };

      body = `# ${upsert.name}\n`;
      if (upsert.overviewAddition?.trim()) {
        body += `\n${upsert.overviewAddition.trim()}\n`;
      }
    }

    frontmatter.entityType = upsert.entityType;
    frontmatter.name = upsert.name;
    frontmatter.aliases = unique([
      ...frontmatter.aliases,
      ...(upsert.aliases ?? []).filter((alias) => alias !== upsert.name),
    ]);
    frontmatter.sources = unique([...frontmatter.sources, upsert.newSource]);
    frontmatter.updated = today();

    for (const [relatedType, links] of Object.entries(upsert.newRelated ?? {})) {
      frontmatter.related[relatedType] = unique([...(frontmatter.related[relatedType] ?? []), ...links]);
    }

    const issues = [
      ...validateFrontmatter(frontmatter, validTypes, validSources),
      ...validateRequiredRelationships(frontmatter, requiredRelatedByType),
    ];
    const errors = issues.filter((issue) => issue.severity === "error");
    const warnings = issues.filter((issue) => issue.severity === "warning");

    if (errors.length > 0) {
      return JSON.stringify(
        {
          success: false,
          action: "upsert-entity",
          error: "Frontmatter validation failed",
          errors,
          warnings,
        },
        null,
        2,
      );
    }

    const evidenceBlock = `\n\n> Source: ${upsert.newSource}\n${upsert.newEvidence.trim()}\n`;
    const overviewBlock = upsert.overviewAddition?.trim()
      ? `\n${upsert.overviewAddition.trim()}\n`
      : "";

    const nextBody = `${body.trimEnd()}${overviewBlock}${evidenceBlock}\n`;
    const nextContent = `${renderEntityFrontmatter(frontmatter)}\n${nextBody}`;

    mkdirSync(entityDir, { recursive: true });
    writeFileSync(entityPath, nextContent, "utf-8");

    return JSON.stringify(
      {
        success: true,
        action: "upsert-entity",
        status: exists ? "updated" : "created",
        path: relative(universeOrMessage.dir, entityPath).replace(/\\/g, "/"),
        warnings,
      },
      null,
      2,
    );
  }

  if (args.action === "write-entity") {
    if (!args.entityData) {
      return JSON.stringify(
        { success: false, code: "E_ENTITY_DATA_REQUIRED", error: "entityData is required" },
        null,
        2,
      );
    }

    let parsed: { frontmatter?: ParsedEntity; body?: string; content?: unknown };
    try {
      parsed = JSON.parse(args.entityData) as { frontmatter?: ParsedEntity; body?: string; content?: unknown };
    } catch {
      return JSON.stringify(
        { success: false, code: "E_ENTITY_DATA_INVALID_JSON", error: "entityData must be valid JSON" },
        null,
        2,
      );
    }

    if (!parsed.frontmatter || typeof parsed.frontmatter !== "object") {
      return JSON.stringify(
        {
          success: false,
          code: "E_ENTITY_DATA_SHAPE",
          error: "entityData must include a frontmatter object",
        },
        null,
        2,
      );
    }

    if ("content" in parsed && typeof parsed.body !== "string") {
      return JSON.stringify(
        {
          success: false,
          code: "E_UNSUPPORTED_FIELD",
          error: "Unsupported field 'content' for write-entity. Use 'body' instead.",
        },
        null,
        2,
      );
    }

    if (typeof parsed.body !== "string") {
      return JSON.stringify(
        {
          success: false,
          code: "E_BODY_MISSING",
          error: "entityData.body is required for write-entity",
        },
        null,
        2,
      );
    }

    const bodyValidation = validateEntityBody(parsed.body, {
      allowEmptyBody: false,
      minChars: MIN_ENTITY_BODY_CHARS,
    });

    if (bodyValidation.errors.length > 0) {
      return JSON.stringify(
        {
          success: false,
          action: "write-entity",
          code: bodyValidation.bodyChars === 0 ? "E_BODY_EMPTY" : "E_BODY_INVALID",
          error: "Body validation failed",
          errors: bodyValidation.errors,
          bodyChars: bodyValidation.bodyChars,
          minBodyChars: MIN_ENTITY_BODY_CHARS,
          signals: bodyValidation.signals,
        },
        null,
        2,
      );
    }

    const frontmatter = parsed.frontmatter;
    frontmatter.aliases = unique(frontmatter.aliases ?? []);
    frontmatter.sources = unique(frontmatter.sources ?? []);
    frontmatter.related = frontmatter.related ?? {};
    frontmatter.created = frontmatter.created || today();
    frontmatter.updated = today();

    const issues = [
      ...validateFrontmatter(frontmatter, validTypes, validSources),
      ...validateRequiredRelationships(frontmatter, requiredRelatedByType),
    ];
    const errors = issues.filter((issue) => issue.severity === "error");
    const warnings = issues.filter((issue) => issue.severity === "warning");

    if (errors.length > 0) {
      return JSON.stringify(
        {
          success: false,
          action: "write-entity",
          error: "Frontmatter validation failed",
          errors,
          warnings,
        },
        null,
        2,
      );
    }

    const entityDir = join(dataDir, frontmatter.entityType);
    const entityPath = join(entityDir, `${frontmatter.name}.md`);
    mkdirSync(entityDir, { recursive: true });
    writeFileSync(entityPath, `${renderEntityFrontmatter(frontmatter)}\n${parsed.body ?? ""}`.trimEnd() + "\n", "utf-8");

    return JSON.stringify(
      {
        success: true,
        action: "write-entity",
        path: relative(universeOrMessage.dir, entityPath).replace(/\\/g, "/"),
        bodyChars: bodyValidation.bodyChars,
        minBodyChars: MIN_ENTITY_BODY_CHARS,
        signals: bodyValidation.signals,
      },
      null,
      2,
    );
  }

  if (args.action === "regenerate-index") {
    const targetTypes = (() => {
      if (!args.path) {
        return getTypeDirectories(dataDir);
      }

      const scoped = safeUniversePath(universeOrMessage.dir, args.path);
      if (!scoped) {
        return null;
      }

      return [basename(scoped.replace(/[\\/]+$/, ""))];
    })();

    if (!targetTypes) {
      return JSON.stringify({ success: false, error: "Invalid path scope" }, null, 2);
    }

    const results: Array<{ entityType: string; path: string; count: number; written: boolean; error?: string }> = [];

    for (const entityType of targetTypes) {
      const typeDir = join(dataDir, entityType);
      if (!existsSync(typeDir)) {
        results.push({
          entityType,
          path: relative(universeOrMessage.dir, typeDir).replace(/\\/g, "/"),
          count: 0,
          written: false,
          error: "Entity type directory does not exist",
        });
        continue;
      }

      const files = getEntityFiles(typeDir);
      const rows = files
        .map((fileName) => {
          const parsed = parseEntityFrontmatter(readFileSync(join(typeDir, fileName), "utf-8"));
          if (!parsed) {
            return null;
          }

          const relatedLinks = unique(Object.values(parsed.related).flat().filter(Boolean));
          return {
            name: parsed.name,
            related: relatedLinks.slice(0, 5).join(", "),
            sources: parsed.sources.slice(0, 3).join(", "),
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

      const table = rows.length
        ? rows.map((row) => `| [[${row.name}]] | ${row.related} | ${row.sources} |`).join("\n")
        : "| _No entities yet_ |  |  |";

      const title = entityType
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (value) => value.toUpperCase());

      const indexContent = [
        "---",
        "type: index",
        `entityType: ${entityType}`,
        `count: ${rows.length}`,
        `updated: "${today()}"`,
        "---",
        "",
        `# ${title}`,
        "",
        "| Name | Related To | Sources |",
        "|------|------------|---------|",
        table,
        "",
      ].join("\n");

      const indexPath = join(typeDir, "_index.md");
      writeFileSync(indexPath, indexContent, "utf-8");
      results.push({
        entityType,
        path: relative(universeOrMessage.dir, indexPath).replace(/\\/g, "/"),
        count: rows.length,
        written: true,
      });
    }

    return JSON.stringify(
      {
        success: results.every((result) => result.written),
        action: "regenerate-index",
        universe: universeName,
        indexesWritten: results.filter((result) => result.written).length,
        indexesFailed: results.filter((result) => !result.written).length,
        results,
      },
      null,
      2,
    );
  }

  const verifyTargets = (() => {
    if (!args.path) {
      const targets: string[] = [];
      for (const entityType of getTypeDirectories(dataDir)) {
        const typeDir = join(dataDir, entityType);
        for (const file of readdirSync(typeDir).filter((name) => name.endsWith(".md") && !name.startsWith("_"))) {
          targets.push(join(typeDir, file));
        }
      }

      return targets;
    }

    const scoped = safeUniversePath(universeOrMessage.dir, args.path);
    if (!scoped) {
      return null;
    }

    if (!existsSync(scoped)) {
      return [];
    }

    if (statSync(scoped).isDirectory()) {
      return readdirSync(scoped)
        .filter((name) => name.endsWith(".md") && !name.startsWith("_"))
        .map((name) => join(scoped, name));
    }

    return [scoped];
  })();

  if (!verifyTargets) {
    return JSON.stringify({ success: false, error: "Invalid verify path scope" }, null, 2);
  }

  const results = verifyTargets.map((filePath) => {
    const relativePath = relative(universeOrMessage.dir, filePath).replace(/\\/g, "/");
    const parsed = parseEntityFrontmatter(readFileSync(filePath, "utf-8"));

    if (!parsed) {
      return {
        file: relativePath,
        valid: false,
        errors: [
          {
            field: "frontmatter",
            message: "Could not parse frontmatter",
            severity: "error" as const,
          },
        ],
        warnings: [],
      };
    }

    const issues = [
      ...validateFrontmatter(parsed, validTypes, validSources),
      ...validateRequiredRelationships(parsed, requiredRelatedByType),
    ];
    return {
      file: relativePath,
      valid: issues.every((issue) => issue.severity !== "error"),
      errors: issues.filter((issue) => issue.severity === "error"),
      warnings: issues.filter((issue) => issue.severity === "warning"),
    };
  });

  return JSON.stringify(
    {
      success: true,
      action: "verify",
      universe: universeName,
      filesChecked: results.length,
      filesInvalid: results.filter((result) => !result.valid).length,
      results,
    },
    null,
    2,
  );
}
