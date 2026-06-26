import { initTRPC } from "@trpc/server";
import { z } from "zod";
import type { AppConfig } from "@xartifact/x-tinker-shared";
import { DEFAULT_APP_CONFIG } from "@xartifact/x-tinker-shared";
import { loadConfig, saveConfig } from "../config/store.js";
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

const appConfigSchema = z.object({
  agent: agentConfigSchema,
  llm: llmConfigSchema,
  repo: repoConfigSchema,
  server: serverConfigSchema,
});

export const configRouter = t.router({
  get: t.procedure.query(async (): Promise<AppConfig> => {
    const root = CONFIG_ROOT;
    try {
      return await loadConfig(root);
    } catch {
      return { ...DEFAULT_APP_CONFIG };
    }
  }),

  save: t.procedure.input(appConfigSchema).mutation(async ({ input }) => {
    const root = CONFIG_ROOT;
    await saveConfig(root, input);
    return { ok: true };
  }),
});

export const eventsRouter = t.router({
  list: t.procedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional())
    .query(async ({ input }) => {
      return listEventsWithFixes(input?.limit ?? 50);
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
  events: eventsRouter,
});

export type AppRouter = typeof appRouter;