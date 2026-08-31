import { initTRPC } from "@trpc/server";
import { z } from "zod";
import type { AppConfig } from "@xartifact/x-tinker-shared";
import { DEFAULT_APP_CONFIG, loadConfig, saveConfig } from "@xartifact/x-tinker-shared";
import { listEventsWithFixes, getEvent } from "../pipeline/store.js";

const t = initTRPC.create();

const CONFIG_ROOT = process.env.CONFIG_ROOT ?? process.cwd();

const llmConfigSchema = z.object({
  provider: z.string(),
  model: z.string(),
  apiKey: z.string(),
  baseUrl: z.string(),
  maxTokens: z.number(),
  temperature: z.number(),
});

const agentConfigSchema = z.object({
  provider: z.string(),
  config: z.string(),
});

const repoConfigSchema = z.object({
  projectPath: z.string(),
  remote: z.string(),
  branchPrefix: z.string(),
});

const serverConfigSchema = z.object({
  port: z.number(),
});

const projectConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  repo: repoConfigSchema,
  verifyCommand: z.string().optional(),
  agent: agentConfigSchema.optional(),
});

const appConfigSchema = z.object({
  agent: agentConfigSchema,
  llm: llmConfigSchema,
  projects: z.array(projectConfigSchema),
  server: serverConfigSchema,
});

export const configRouter = t.router({
  get: t.procedure.query(async (): Promise<AppConfig> => {
    const root = CONFIG_ROOT;
    try {
      // loadConfig migrates legacy single-project configs into `projects` on the fly
      return await loadConfig(root);
    } catch {
      return structuredClone(DEFAULT_APP_CONFIG);
    }
  }),

  save: t.procedure.input(appConfigSchema).mutation(async ({ input }) => {
    const root = CONFIG_ROOT;
    await saveConfig(root, input);
    return { ok: true };
  }),
});

export const projectsRouter = t.router({
  list: t.procedure.query(async () => {
    const config = await loadConfig(CONFIG_ROOT);
    return config.projects;
  }),

  create: t.procedure.input(projectConfigSchema).mutation(async ({ input }) => {
    const config = await loadConfig(CONFIG_ROOT);
    if (config.projects.some((p) => p.id === input.id)) {
      throw new Error(`Project id "${input.id}" already exists`);
    }
    config.projects.push(input);
    await saveConfig(CONFIG_ROOT, config);
    return input;
  }),

  update: t.procedure.input(projectConfigSchema).mutation(async ({ input }) => {
    const config = await loadConfig(CONFIG_ROOT);
    const idx = config.projects.findIndex((p) => p.id === input.id);
    if (idx === -1) {
      throw new Error(`Project id "${input.id}" not found`);
    }
    config.projects[idx] = input;
    await saveConfig(CONFIG_ROOT, config);
    return input;
  }),

  delete: t.procedure.input(z.object({ id: z.string().min(1) })).mutation(async ({ input }) => {
    const config = await loadConfig(CONFIG_ROOT);
    const before = config.projects.length;
    config.projects = config.projects.filter((p) => p.id !== input.id);
    if (config.projects.length === before) {
      throw new Error(`Project id "${input.id}" not found`);
    }
    await saveConfig(CONFIG_ROOT, config);
    return { ok: true };
  }),
});

export const eventsRouter = t.router({
  list: t.procedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(200).default(50),
          projectId: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      return listEventsWithFixes(input?.limit ?? 50, input?.projectId);
    }),
  get: t.procedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const event = await getEvent(input.id);
      return event;
    }),
});

export const appRouter = t.router({
  appConfig: configRouter,
  projects: projectsRouter,
  events: eventsRouter,
});

export type AppRouter = typeof appRouter;
