import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import type { AgentProvider, AgentFixRequest, AgentFixResult } from "../agent-types.js";

/**
 * OpenCode Agent provider.
 *
 * Communicates with OpenCode CLI via subprocess to fix code.
 * OpenCode reads the error context, edits the source files, and returns the diff.
 *
 * Configuration:
 *   - opencode_binary: path to the `opencode` binary (default: "opencode")
 *   - model: model override for the agent session
 *   - timeout_ms: max execution time (default: 120000)
 */
export class OpenCodeAgentProvider implements AgentProvider {
  readonly name = "opencode";
  private binary = "opencode";
  private timeoutMs = 120_000;

  init(config: Record<string, string>): void {
    if (config.opencode_binary) this.binary = config.opencode_binary;
    if (config.timeout_ms) this.timeoutMs = parseInt(config.timeout_ms, 10);
  }

  async fix(request: AgentFixRequest): Promise<AgentFixResult> {
    const promptFile = resolve(tmpdir(), `x-tinker-fix-${Date.now()}.md`);

    try {
      // 1. Write the fix instruction to a temp file
      const instruction = this.buildInstruction(request);
      writeFileSync(promptFile, instruction, "utf-8");

      // 2. Invoke OpenCode via subprocess
      const cmd = [
        this.binary,
        `--prompt-file="${promptFile}"`,
        `--cwd="${request.projectPath}"`,
        "--output=diff",
      ].join(" ");

      const output = execSync(cmd, {
        cwd: request.projectPath,
        timeout: this.timeoutMs,
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      });

      // 3. Parse the diff output
      return this.parseOutput(output, request);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        applied: false,
        diff: "",
        files: [],
        summary: "",
        error: `OpenCode agent failed: ${errorMsg}`,
      };
    } finally {
      try {
        unlinkSync(promptFile);
      } catch {}
    }
  }

  /**
   * Build the instruction prompt for the OpenCode agent
   */
  private buildInstruction(request: AgentFixRequest): string {
    return [
      `# Fix Bug - ${request.errorType}`,
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
      `## Source Code Context`,
      "```",
      request.sourceCode,
      "```",
      "",
      "## Task",
      `1. Read the file \`${request.filePath}\` to understand the full context`,
      `2. Diagnose the root cause of the error`,
      `3. Apply a minimal fix to the source file`,
      "4. After fixing, output a unified diff of your changes",
      "",
      "## Rules",
      "- Fix the root cause, not just the symptom",
      "- Keep changes minimal — change ONLY what's needed",
      "- Consider edge cases and type safety",
      "- Output the final unified diff after making changes",
    ].join("\n");
  }

  /**
   * Parse the diff from OpenCode's output
   */
  private parseOutput(output: string, request: AgentFixRequest): AgentFixResult {
    // Extract diff blocks from markdown code fences
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

    // Extract file names from diff headers
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