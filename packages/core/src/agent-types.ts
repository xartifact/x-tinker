import type { FixPatch } from "@xartifact/x-tinker-shared";

/**
 * ACP/A2A message — instruction sent to a Coding Agent
 */
export interface AgentFixRequest {
  /** Error type */
  errorType: string;
  /** Error message */
  errorMessage: string;
  /** Full stack trace */
  stackTrace: string;
  /** File path relative to project root where error occurred */
  filePath: string;
  /** Error line number */
  errorLine: number;
  /** Source code context around the error (with line number annotations) */
  sourceCode: string;
  /** Absolute path to the project root (PROJECT_A_PATH) */
  projectPath: string;
  /** Optional: task complexity hint for the agent */
  complexity?: "simple" | "moderate" | "complex";
}

/**
 * Result returned by a Coding Agent after attempting a fix
 */
export interface AgentFixResult {
  /** Whether the agent considers the fix applied */
  applied: boolean;
  /** The generated patch/diff content */
  diff: string;
  /** Files that were modified */
  files: string[];
  /** Summary of the fix */
  summary: string;
  /** Error message if the agent failed */
  error?: string;
}

/**
 * AgentProvider interface — abstract interface for ACP/A2A Coding Agents.
 *
 * Implementations:
 * - OpenCodeAgentProvider: communicates with OpenCode agent via STDIO or HTTP
 * - ClaudeCodeAgentProvider: invokes Claude Code CLI
 * - Custom: any agent following ACP/A2A protocol
 */
export interface AgentProvider {
  /** Provider name identifier */
  readonly name: string;

  /**
   * Fix an error by delegating to a Coding Agent.
   * The agent is expected to:
   * 1. Read and understand the error + source code
   * 2. Diagnose the root cause
   * 3. Edit the source file(s) to fix the bug
   * 4. Return the diff of changes made
   */
  fix(request: AgentFixRequest): Promise<AgentFixResult>;

  /** Initialize the provider with configuration */
  init(config: Record<string, string>): void;
}