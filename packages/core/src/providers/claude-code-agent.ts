import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import type { AgentProvider, AgentFixRequest, AgentFixResult } from "../agent-types.js";

/**
 * Claude Code Agent provider.
 *
 * Invokes Claude Code CLI (`claude`) via subprocess to diagnose and fix code.
 * Claude Code reads the source, analyzes the error, edits files, and outputs a diff.
 *
 * Configuration:
 *   - claude_binary: path to the `claude` binary (default: "claude")
 *   - timeout_ms: max execution time (default: 180000)
 *   - model: model override (e.g., "claude-sonnet-4-20250514")
 */
export class ClaudeCodeAgentProvider implements AgentProvider {
  readonly name = "claude-code";
  private binary = "claude";
  private timeoutMs = 180_000;
  private model = "";

  init(config: Record<string, string>): void {
    if (config.claude_binary) this.binary = config.claude_binary;
    if (config.timeout_ms) this.timeoutMs = parseInt(config.timeout_ms, 10);
    if (config.model) this.model = config.model;
  }

  async fix(request: AgentFixRequest): Promise<AgentFixResult> {
    const promptFile = resolve(tmpdir(), `x-tinker-fix-${Date.now()}.md`);

    try {
      const instruction = this.buildInstruction(request);
      writeFileSync(promptFile, instruction, "utf-8");

      const modelArgs = this.model ? ["--model", this.model] : [];
      const output = execSync(
        [this.binary, ...modelArgs, `--print`, `--prompt`, instruction].join(" "),
        {
          cwd: request.projectPath,
          timeout: this.timeoutMs,
          encoding: "utf-8",
          maxBuffer: 10 * 1024 * 1024,
          shell: "/bin/sh",
        },
      );

      return this.parseOutput(output, request);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        applied: false,
        diff: "",
        files: [],
        summary: "",
        error: `Claude Code failed: ${errorMsg}`,
      };
    } finally {
      try {
        unlinkSync(promptFile);
      } catch {}
    }
  }

  private buildInstruction(request: AgentFixRequest): string {
    return [
      `Fix this error in the codebase at ${request.projectPath}`,
      "",
      `## Error`,
      `- **Type**: ${request.errorType}`,
      `- **Message**: ${request.errorMessage}`,
      `- **File**: ${request.filePath}:${request.errorLine}`,
      "",
      `## Stack Trace`,
      "```",
      request.stackTrace,
      "```",
      "",
      `## Task`,
      `1. Read \`${request.filePath}\` and understand the full context`,
      `2. Diagnose the root cause`,
      `3. Apply a minimal fix`,
      `4. Output a unified diff (diff -u format) of what you changed`,
      "",
      `IMPORTANT: Only output the unified diff. No explanations.`,
    ].join("\n");
  }

  private parseOutput(output: string, request: AgentFixRequest): AgentFixResult {
    const diffMatch = output.match(/```(?:diff)?\s*\n([\s\S]*?)```/);
    const diff = diffMatch ? diffMatch[1].trim() : output.trim();

    if (!diff || !diff.includes("---") || !diff.includes("+++")) {
      return {
        applied: false,
        diff: "",
        files: [],
        summary: "",
        error: "No valid diff found in agent output",
      };
    }

    const files: string[] = [];
    const filePattern = /\+\+\+\s+(?:b\/)?(.+)/g;
    let fileMatch: RegExpExecArray | null;
    while ((fileMatch = filePattern.exec(diff)) !== null) {
      const f = fileMatch[1].trim();
      if (!files.includes(f)) files.push(f);
    }

    return {
      applied: true,
      diff,
      files,
      summary: `Fix ${request.errorType}: ${request.errorMessage}`,
    };
  }
}