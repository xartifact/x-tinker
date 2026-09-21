import { spawn, execFileSync } from "node:child_process";
import type { AgentProvider, AgentFixRequest, AgentFixResult } from "../agent-types.js";

/**
 * pi Coding Agent provider.
 *
 * Delegates the fix to `pi --mode rpc`, which speaks a JSONL command/event
 * protocol over stdin/stdout. Unlike the CLI-invocation providers, pi edits the
 * source tree directly, so the diff is not parsed out of the agent's prose: it
 * is read back from the working tree with `git diff HEAD` once the agent
 * settles. That is the only trustworthy source of "what actually changed".
 *
 * Protocol shape (observed against pi 0.85.1):
 *   → {"type":"prompt","message":"…"}
 *   ← {"type":"response","command":"prompt","success":true}
 *   ← agent_start / turn_start / message_* / turn_end / agent_end / agent_settled
 *
 * stdin must stay open until `agent_settled`: pi treats EOF as "no more input"
 * and exits before finishing the turn.
 *
 * Configuration:
 *   - pi_binary / binary: path to the `pi` binary (default: "pi")
 *   - provider: model provider passed through as `--provider`
 *   - model: model pattern passed through as `--model`
 *   - timeout_ms / timeout: max execution time (default: 180000)
 */
export class PiAgentProvider implements AgentProvider {
  readonly name = "pi";
  private binary = "pi";
  private timeoutMs = 180_000;
  private provider = "";
  private model = "";

  init(config: Record<string, string>): void {
    const binary = config.pi_binary ?? config.binary;
    if (binary) this.binary = binary;
    if (config.provider) this.provider = config.provider;
    if (config.model) this.model = config.model;
    const timeout = config.timeout_ms ?? config.timeout;
    if (timeout) this.timeoutMs = parseInt(timeout, 10);
  }

  async fix(request: AgentFixRequest): Promise<AgentFixResult> {
    try {
      const settled = await this.runPrompt(request);
      if (settled.error !== undefined) {
        return { applied: false, diff: "", files: [], summary: "", error: settled.error };
      }
      return this.collectDiff(request.projectPath, settled.summary);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { applied: false, diff: "", files: [], summary: "", error: `pi agent failed: ${msg}` };
    }
  }

  /**
   * Drive one `pi --mode rpc` session to `agent_settled`.
   * @param request - the fix request.
   * @returns the agent's final assistant text, or an `error` when the turn failed.
   */
  private runPrompt(request: AgentFixRequest): Promise<{ summary: string; error?: string }> {
    const { promise, resolve } = Promise.withResolvers<{ summary: string; error?: string }>();
    const args = ["--mode", "rpc", "--no-session"];
    if (this.provider) args.push("--provider", this.provider);
    if (this.model) args.push("--model", this.model);

    const proc = spawn(this.binary, args, {
      cwd: request.projectPath,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let settledText = "";
    let stderr = "";
    let buffer = "";
    let done = false;
    let promptAccepted = false;

    const finish = (outcome: { summary: string; error?: string }): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      // End stdin first so pi can exit on its own; kill only if it ignores that.
      proc.stdin.end();
      const killTimer = setTimeout(() => proc.kill("SIGKILL"), 2_000);
      proc.once("exit", () => clearTimeout(killTimer));
      resolve(outcome);
    };

    const timer = setTimeout(() => {
      finish({ summary: "", error: `pi timed out after ${this.timeoutMs}ms` });
    }, this.timeoutMs);

    const handleEvent = (event: Record<string, unknown>): void => {
      const type = event.type;
      if (type === "response" && event.command === "prompt") {
        // The prompt itself can be rejected (bad provider/model, no API key).
        if (event.success === false) {
          const detail = typeof event.error === "string" ? event.error : "prompt rejected";
          finish({ summary: "", error: `pi rejected the prompt: ${detail}` });
          return;
        }
        promptAccepted = true;
        return;
      }
      if (type === "message_end" || type === "turn_end") {
        const message = event.message as { role?: string; content?: Array<{ type: string; text?: string }> } | undefined;
        if (message?.role === "assistant") {
          const text = (message.content ?? [])
            .filter((part) => part.type === "text")
            .map((part) => part.text ?? "")
            .join("");
          if (text) settledText = text;
        }
        return;
      }
      if (type === "agent_settled") {
        finish({ summary: settledText });
      }
    };

    proc.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      // Keep the trailing partial line for the next chunk.
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          handleEvent(JSON.parse(trimmed) as Record<string, unknown>);
        } catch {
          // Non-JSON stdout is not part of the protocol; ignore rather than
          // abort a turn that may still settle.
        }
      }
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("error", (err: Error) => {
      finish({ summary: "", error: `failed to spawn ${this.binary}: ${err.message}` });
    });

    proc.on("exit", (code) => {
      if (done) return;
      // Exiting before `agent_settled` means the turn never completed — report
      // the reason instead of returning a silent empty result.
      const detail = stderr.trim().split("\n").slice(-3).join("\n");
      finish({
        summary: "",
        error: promptAccepted
          ? `pi exited (code ${String(code)}) before the turn settled${detail ? `: ${detail}` : ""}`
          : `pi exited (code ${String(code)}) without accepting the prompt${detail ? `: ${detail}` : ""}`,
      });
    });

    proc.stdin.write(`${JSON.stringify({ type: "prompt", message: this.buildInstruction(request) })}\n`);
    return promise;
  }

  /**
   * Read the changes the agent made to the working tree.
   * @param projectPath - repository root the agent edited.
   * @param summary - agent's own closing text, used as the fix summary.
   * @returns the diff plus the changed files, or a failure when nothing changed.
   */
  private collectDiff(projectPath: string, summary: string): AgentFixResult {
    let diff = "";
    try {
      diff = execFileSync("git", ["diff", "HEAD"], {
        cwd: projectPath,
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { applied: false, diff: "", files: [], summary: "", error: `git diff failed: ${msg}` };
    }

    if (!diff.trim()) {
      return {
        applied: false,
        diff: "",
        files: [],
        summary: "",
        error: "pi finished without changing the working tree (no diff against HEAD)",
      };
    }

    const files: string[] = [];
    const filePattern = /^\+\+\+\s+(?:b\/)?(.+)$/gm;
    let match: RegExpExecArray | null;
    while ((match = filePattern.exec(diff)) !== null) {
      const file = match[1].trim();
      if (file !== "/dev/null" && !files.includes(file)) files.push(file);
    }

    return {
      applied: true,
      diff,
      files,
      summary: summary || `Fix ${this.name} changes in ${files.length} file(s)`,
    };
  }

  /** Build the fix instruction handed to pi. */
  private buildInstruction(request: AgentFixRequest): string {
    return [
      `Fix this error in the codebase at ${request.projectPath}`,
      "",
      "## Error",
      `- **Type**: ${request.errorType}`,
      `- **Message**: ${request.errorMessage}`,
      `- **File**: ${request.filePath}:${request.errorLine}`,
      "",
      "## Stack Trace",
      "```",
      request.stackTrace,
      "```",
      "",
      "## Source Code Context",
      "```",
      request.sourceCode,
      "```",
      "",
      "## Task",
      `1. Read \`${request.filePath}\` and understand the full context`,
      "2. Diagnose the root cause",
      "3. Apply a minimal fix directly to the source file(s)",
      "",
      "## Rules",
      "- Fix the root cause, not just the symptom",
      "- Keep changes minimal — change ONLY what's needed",
      "- Edit the files directly; do not merely describe the change",
    ].join("\n");
  }
}
