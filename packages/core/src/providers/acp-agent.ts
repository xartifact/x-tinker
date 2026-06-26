import { spawn } from "node:child_process";
import { Writable, Readable } from "node:stream";
import * as acp from "@agentclientprotocol/sdk";
import type { AgentProvider, AgentFixRequest, AgentFixResult } from "../agent-types.js";

export class AcpAgentProvider implements AgentProvider {
  readonly name = "acp";
  private binary = "opencode";
  private args = "--acp";
  private timeoutMs = 120_000;

  init(config: Record<string, string>): void {
    if (config.binary) this.binary = config.binary;
    if (config.args) this.args = config.args;
    if (config.timeout) this.timeoutMs = parseInt(config.timeout, 10);
  }

  async fix(request: AgentFixRequest): Promise<AgentFixResult> {
    const argList = this.args.split(/\s+/).filter(Boolean);
    const proc = spawn(this.binary, argList, { stdio: ["pipe", "pipe", "inherit"] });
    const input = Writable.toWeb(proc.stdin!) as WritableStream<Uint8Array>;
    const output = Readable.toWeb(proc.stdout!) as ReadableStream<Uint8Array>;
    const stream = acp.ndJsonStream(input, output);
    const timer = setTimeout(() => proc.kill(), this.timeoutMs);

    try {
      let resultText = "";

      await acp
        .client({ name: "x-tinker" })
        .onRequest(acp.methods.client.session.requestPermission, async () => ({
          outcome: { outcome: "selected", optionId: "" },
        }))
        .onRequest(acp.methods.client.fs.writeTextFile, async () => ({}))
        .onRequest(acp.methods.client.fs.readTextFile, async () => ({
          content: request.sourceCode,
        }))
        .onNotification(acp.methods.client.session.update, (ctx) => {
          const u = ctx.params.update;
          if (u.sessionUpdate === "agent_message_chunk" && u.content.type === "text") {
            resultText += u.content.text;
          }
        })
        .connectWith(stream, async (ctx) => {
          await ctx.request(acp.methods.agent.initialize, {
            protocolVersion: acp.PROTOCOL_VERSION,
            clientCapabilities: { fs: { readTextFile: true, writeTextFile: true } },
          });
          const session = await ctx.buildSession(request.projectPath).start();
          await session.prompt(this.buildPrompt(request));
          for (;;) {
            const msg = await session.nextUpdate();
            if (msg.kind === "stop") break;
          }
        });

      return this.parseResult(resultText, request);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { applied: false, diff: "", files: [], summary: "", error: `ACP agent failed: ${msg}` };
    } finally {
      clearTimeout(timer);
      proc.kill();
    }
  }

  private buildPrompt(request: AgentFixRequest): string {
    return [
      `Fix this bug in \`${request.filePath}:${request.errorLine}\`.`,
      "",
      `## Error`,
      `- **Type**: ${request.errorType}`,
      `- **Message**: ${request.errorMessage}`,
      "",
      `## Stack Trace`,
      "```",
      request.stackTrace,
      "```",
      "",
      "## Instructions",
      `1. Read \`${request.filePath}\` to understand the context`,
      "2. Diagnose the root cause",
      "3. Apply a minimal fix to the source file",
      "4. Output a unified diff of your changes",
    ].join("\n");
  }

  private parseResult(text: string, request: AgentFixRequest): AgentFixResult {
    const m = text.match(/```(?:diff)?\s*\n([\s\S]*?)```/);
    const diff = m ? m[1].trim() : text.trim();
    if (!diff || !diff.includes("---") || !diff.includes("+++")) {
      return { applied: false, diff: "", files: [], summary: "", error: "No valid diff found" };
    }
    const files: string[] = [];
    const re = /\+\+\+\s+(?:b\/)?(.+)/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(diff)) !== null) {
      if (!files.includes(match[1].trim())) files.push(match[1].trim());
    }
    return { applied: true, diff, files, summary: `Fix ${request.errorType}: ${request.errorMessage}` };
  }
}