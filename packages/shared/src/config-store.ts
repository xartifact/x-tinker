import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { AppConfig, ProjectConfig } from "./types.js";
import { DEFAULT_APP_CONFIG } from "./types.js";

const CONFIG_DIR = ".x-tinker";
const CONFIG_FILE = "config.json";

function getConfigPath(rootDir: string): string {
  return resolve(rootDir, CONFIG_DIR, CONFIG_FILE);
}

function getConfigDir(rootDir: string): string {
  return resolve(rootDir, CONFIG_DIR);
}

/**
 * Whether a config file exists on disk — i.e. the operator has explicitly
 * configured x-tinker. Env-only deployments (fresh docker, no config.json)
 * return false and the pipeline falls back to PROJECT_A_PATH.
 */
export async function configExists(rootDir: string): Promise<boolean> {
  return existsSync(getConfigPath(rootDir));
}

/**
 * Legacy single-project configs ({ agent, llm, repo, server }) are migrated
 * on load into the multi-project shape: repo becomes projects[0] with id
 * "default". The deprecated top-level repo field is dropped from the result,
 * so the next saveConfig() writes the new format only.
 */
function migrateLegacyConfig(parsed: Record<string, unknown>): ProjectConfig[] | null {
  if (Array.isArray(parsed.projects)) return null; // already multi-project
  const legacyRepo = parsed.repo as AppConfig["repo"] | undefined;
  if (!legacyRepo) return null; // fresh config — use defaults

  return [
    {
      id: "default",
      name: "Default Project",
      repo: { ...DEFAULT_APP_CONFIG.projects[0].repo, ...legacyRepo },
      verifyCommand: "",
    },
  ];
}

function normalizeProject(p: Partial<ProjectConfig>): ProjectConfig {
  return {
    id: p.id ?? "default",
    name: p.name ?? p.id ?? "Unnamed Project",
    repo: { ...DEFAULT_APP_CONFIG.projects[0].repo, ...p.repo },
    verifyCommand: p.verifyCommand ?? "",
    ...(p.agent ? { agent: p.agent } : {}),
  };
}

export async function loadConfig(rootDir: string): Promise<AppConfig> {
  const configPath = getConfigPath(rootDir);
  try {
    const raw = await readFile(configPath, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    const migrated = migrateLegacyConfig(parsed);
    const rawProjects = migrated ?? (parsed.projects as Partial<ProjectConfig>[] | undefined);

    return {
      agent: { ...DEFAULT_APP_CONFIG.agent, ...(parsed.agent as object) },
      llm: { ...DEFAULT_APP_CONFIG.llm, ...(parsed.llm as object) },
      projects: rawProjects ? rawProjects.map(normalizeProject) : structuredClone(DEFAULT_APP_CONFIG.projects),
      server: { ...DEFAULT_APP_CONFIG.server, ...(parsed.server as object) },
    };
  } catch {
    return structuredClone(DEFAULT_APP_CONFIG);
  }
}

export async function saveConfig(rootDir: string, config: AppConfig): Promise<void> {
  const dir = getConfigDir(rootDir);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  const configPath = getConfigPath(rootDir);
  const { repo: _deprecated, ...clean } = config;
  await writeFile(configPath, JSON.stringify(clean, null, 2), "utf-8");
}

/**
 * Strictly look up a project config by the projectId reported in an ErrorEvent.
 * Returns undefined for unknown projectIds — the caller decides the fallback
 * policy (see runPipeline: strict when a config file exists, lenient otherwise).
 */
export function findProject(config: AppConfig, projectId: string): ProjectConfig | undefined {
  return config.projects.find((p) => p.id === projectId);
}

/** The first project with id "default", or the first configured project. */
export function defaultProject(config: AppConfig): ProjectConfig | undefined {
  return config.projects.find((p) => p.id === "default") ?? config.projects[0];
}
