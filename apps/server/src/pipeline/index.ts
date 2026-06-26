/**
 * Fix Pipeline
 *
 * Orchestrates the full fix flow:
 *   receive → analyze → generate patch → apply → verify → commit → record
 */

import type { ErrorEvent, FixPatch, FixResult, LLMConfig } from "@xartifact/x-tinker-shared";
import { LLMClient, fixWithAgent } from "@xartifact/x-tinker-core";
import { generatePatch } from "@xartifact/x-tinker-core";
import type { PatchPromptContext, AgentFixRequest } from "@xartifact/x-tinker-core";
import { readSourceContext } from "./read-source.js";
import { applyPatch } from "./apply-patch.js";
import { verifyFix } from "./verify.js";
import { commitFix } from "./commit.js";
import { recordFix } from "./store.js";
import { loadConfig } from "../config/store.js";

/**
 * Resolve LLM client from the saved AppConfig.llm config.
 * Falls back to environment variables, then mock.
 */
async function resolveLLMClient(): Promise<LLMClient> {
  const configRoot = process.env.CONFIG_ROOT ?? process.cwd();
  const appConfig = await loadConfig(configRoot);
  const llm: LLMConfig = appConfig.llm;

  const apiKey = llm.apiKey || process.env.LLM_API_KEY || "";
  if (!apiKey && process.env.LLM_MOCK !== "true") {
    return new LLMClient({ provider: "mock", model: "", apiKey: "mock-key", baseUrl: "", maxTokens: 2048, temperature: 0.1 });
  }

  return new LLMClient({
    provider: llm.provider,
    model: llm.model,
    apiKey,
    baseUrl: llm.baseUrl || undefined,
    maxTokens: llm.maxTokens,
    temperature: llm.temperature,
  } as LLMConfig);
}

/**
 * Run the full fix pipeline for an error event
 */
export async function runPipeline(event: ErrorEvent): Promise<FixResult> {
  const projectPath = process.env.PROJECT_A_PATH;
  if (!projectPath) {
    throw new Error("PROJECT_A_PATH environment variable is required — set it to Project A's root directory");
  }

  console.log(`[pipeline] Step 1/7: Analyzing error event ${event.id}`);
  const { sourceContext } = event;

  console.log(`[pipeline] Step 2/7: Reading source context from ${projectPath}/${sourceContext.filePath}`);
  const sourceCode = await readSourceContext(projectPath, sourceContext.filePath, sourceContext.line);

  const configRoot = process.env.CONFIG_ROOT ?? process.cwd();
  const appConfig = await loadConfig(configRoot);
  const agentProvider = appConfig.agent.provider;

  let patch: FixPatch;

  if (agentProvider && agentProvider !== "none") {
    // ── Agent mode: delegate to ACP/A2A Coding Agent for code modification ──
    console.log(`[pipeline] Step 3-4/7: Delegating fix to agent "${agentProvider}"`);

    const agentConfig: Record<string, string> = {};
    for (const pair of appConfig.agent.config.split(";").filter(Boolean)) {
      const [k, v] = pair.split("=");
      if (k && v) agentConfig[k.trim()] = v.trim();
    }

    const agentRequest: AgentFixRequest = {
      errorType: event.errorType,
      errorMessage: event.message,
      stackTrace: event.stackTrace,
      filePath: sourceContext.filePath,
      errorLine: sourceContext.line,
      sourceCode: sourceCode.annotated,
      projectPath,
    };

    try {
      const agentResult = await fixWithAgent(agentProvider, agentConfig, agentRequest);
      if (!agentResult.applied) {
        throw new Error(agentResult.error ?? "Agent did not apply a fix");
      }
      patch = {
        diff: agentResult.diff,
        files: agentResult.files,
        summary: agentResult.summary,
      };
      console.log(`[pipeline] Agent applied fix to ${patch.files.join(", ")}`);
    } catch (err) {
      const result: FixResult = {
        eventId: event.id,
        patch: { diff: "", files: [], summary: "" },
        status: "failed",
        error: `Agent fix failed: ${err instanceof Error ? err.message : String(err)}`,
      };
      await recordFix(result);
      return result;
    }
  } else {
    // ── LLM mode: generate diff, then apply directly ──
    console.log(`[pipeline] Step 3/7: Generating fix patch via LLM`);
    const client = await resolveLLMClient();

    const patchCtx: PatchPromptContext = {
      errorType: event.errorType,
      errorMessage: event.message,
      stackTrace: event.stackTrace,
      filePath: sourceContext.filePath,
      sourceCode: sourceCode.annotated,
      errorLine: sourceContext.line,
    };

    try {
      patch = await generatePatch(client, patchCtx);
    } catch (err) {
      const result: FixResult = {
        eventId: event.id,
        patch: { diff: "", files: [], summary: "" },
        status: "failed",
        error: `LLM call failed: ${err instanceof Error ? err.message : String(err)}`,
      };
      await recordFix(result);
      return result;
    }

    console.log(`[pipeline] Step 4/7: Applying patch to ${patch.files.join(", ")}`);
    try {
      await applyPatch(projectPath, patch);
    } catch (err) {
      const result: FixResult = {
        eventId: event.id,
        patch,
        status: "failed",
        error: `Apply patch failed: ${err instanceof Error ? err.message : String(err)}`,
      };
      await recordFix(result);
      return result;
    }
  }

  console.log(`[pipeline] Step 5/7: Verifying fix`);
  const verificationOutput = await verifyFix(projectPath, event);

  const isVerified = verificationOutput === null;
  console.log(`[pipeline] Verification: ${isVerified ? "PASSED" : "FAILED — " + verificationOutput}`);

  if (!isVerified) {
    const result: FixResult = {
      eventId: event.id,
      patch,
      status: "failed",
      verificationOutput,
      error: "Verification failed",
    };
    await recordFix(result);
    return result;
  }

  console.log(`[pipeline] Step 6/7: Committing fix`);
  let commitSha: string | undefined;
  try {
    commitSha = await commitFix(projectPath, patch.summary, event.id);
  } catch (err) {
    console.warn(`[pipeline] Commit failed (non-fatal for MVP):`, err);
  }

  console.log(`[pipeline] Step 7/7: Recording result`);
  const result: FixResult = {
    eventId: event.id,
    patch,
    status: "verified",
    verificationOutput: verificationOutput ?? undefined,
    verifiedAt: new Date().toISOString(),
    committedAt: commitSha ? new Date().toISOString() : undefined,
    commitSha,
  };
  await recordFix(result);

  console.log(`[pipeline] ✅ Fix pipeline complete for ${event.id}`);
  return result;
}
