import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { AppConfig } from "./types.js";
import { DEFAULT_APP_CONFIG } from "./types.js";

const CONFIG_DIR = ".x-tinker";
const CONFIG_FILE = "config.json";

function getConfigPath(rootDir: string): string {
  return resolve(rootDir, CONFIG_DIR, CONFIG_FILE);
}

function getConfigDir(rootDir: string): string {
  return resolve(rootDir, CONFIG_DIR);
}

export async function loadConfig(rootDir: string): Promise<AppConfig> {
  const configPath = getConfigPath(rootDir);
  try {
    const raw = await readFile(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_APP_CONFIG, ...parsed, agent: { ...DEFAULT_APP_CONFIG.agent, ...parsed.agent }, llm: { ...DEFAULT_APP_CONFIG.llm, ...parsed.llm }, repo: { ...DEFAULT_APP_CONFIG.repo, ...parsed.repo } };
  } catch {
    return { ...DEFAULT_APP_CONFIG };
  }
}

export async function saveConfig(rootDir: string, config: AppConfig): Promise<void> {
  const dir = getConfigDir(rootDir);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  const configPath = getConfigPath(rootDir);
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
}
