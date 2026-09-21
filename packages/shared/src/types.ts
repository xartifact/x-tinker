/**
 * Error severity levels
 */
export type ErrorSeverity = "low" | "medium" | "high" | "critical";

/**
 * Represents a stack frame in the error trace
 */
export interface StackFrame {
  file: string;
  line: number;
  column: number;
  functionName?: string;
}

/**
 * Context around the error location in source code
 */
export interface SourceContext {
  /** File path relative to project root */
  filePath: string;
  /** The error line number (1-indexed) */
  line: number;
  /** Lines before the error (up to 5) */
  before: string[];
  /** The exact error line */
  lineContent: string;
  /** Lines after the error (up to 5) */
  after: string[];
}

/**
 * Error event reported from Project A to Project X
 */
export interface ErrorEvent {
  /** Unique event ID */
  id: string;
  /** Project identifier */
  projectId: string;
  /** Error name (e.g., TypeError, ReferenceError) */
  errorType: string;
  /** Error message */
  message: string;
  /** Stack trace as string */
  stackTrace: string;
  /** Parsed stack frames */
  frames: StackFrame[];
  /** Source context for the top frame */
  sourceContext: SourceContext;
  /** GitHub repository info for source code access */
  repository?: {
    owner: string;
    name: string;
    /** Commit SHA at time of error */
    commitSha: string;
    /** Branch name */
    branch: string;
  };
  /** Runtime environment info */
  environment?: Record<string, string>;
  /** Timestamp */
  timestamp: string;
  /** Error severity */
  severity: ErrorSeverity;
}

/**
 * Fix patch produced by the agent
 */
export interface FixPatch {
  /** The diff/patch content (unified diff format) */
  diff: string;
  /** Files modified */
  files: string[];
  /** Summary of what was changed */
  summary: string;
}

/**
 * Result of a fix attempt
 */
export interface FixResult {
  eventId: string;
  patch: FixPatch;
  status: "pending" | "applied" | "verified" | "failed" | "rejected";
  verificationOutput?: string;
  verifiedAt?: string;
  committedAt?: string;
  commitSha?: string;
  error?: string;
}

/**
 * LLM configuration for non-coding tasks (analysis, summarization, classification).
 * Not used for code modification — that's handled by AgentConnection.
 */
export interface LLMConfig {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  maxTokens: number;
  temperature: number;
}

/**
 * Agent pipeline step identifiers
 */
export type PipelineStep =
  | "receive"
  | "analyze"
  | "generate_patch"
  | "apply_patch"
  | "verify"
  | "commit"
  | "record";

// ─── App Configuration (for frontend) ────────────────────────

/**
 * Coding Agent configuration via ACP/A2A protocol.
 * x-tinker delegates code modification to an external Coding Agent (e.g. OpenCode, Claude Code).
 */
export interface AgentConnection {
  /** Agent provider name (e.g., "opencode", "claude-code") */
  provider: string;
  /** Agent config as semicolon-separated key=value pairs (e.g., "timeout_ms=120000") */
  config: string;
}

/**
 * Repository configuration for source code access
 */
export interface RepoConfig {
  /** Local path to Project A's source */
  projectPath: string;
  /** GitHub remote URL (for PR creation) */
  remote: string;
  /** Branch prefix for auto-fix branches */
  branchPrefix: string;
}

/**
 * Per-project configuration — maps the projectId reported by the SDK
 * to its source repository and fix settings.
 */
export interface ProjectConfig {
  /** Unique project id — must match the projectId the SDK reports in ErrorEvent */
  id: string;
  /** Display name */
  name: string;
  /** Repository / source access config */
  repo: RepoConfig;
  /** Command to verify a fix, run in repo.projectPath. Empty = skip verification */
  verifyCommand?: string;
  /** Optional per-project agent override; falls back to the global agent config */
  agent?: AgentConnection;
}

/**
 * Full app configuration stored on disk.
 *
 * Agent and LLM are global defaults; each project only carries its repo
 * location and (optionally) overrides the agent used to fix it.
 */
export interface AppConfig {
  /** Coding Agent config for code modification (ACP/A2A) */
  agent: AgentConnection;
  /** LLM config for non-coding tasks (analysis, summarization) */
  llm: LLMConfig;
  /** Projects that can report errors and be fixed */
  projects: ProjectConfig[];
  server: {
    port: number;
  };
  /** @deprecated Legacy single-project field — migrated into `projects` on load, dropped on save */
  repo?: RepoConfig;
}

/**
 * Default app configuration
 */
export const DEFAULT_APP_CONFIG: AppConfig = {
  agent: {
    // pi edits the working tree directly and reports a real `git diff HEAD`,
    // so it is the default delegate. ACP / OpenCode / Claude Code stay
    // available as switchable fallbacks via the agent config.
    provider: "pi",
    config: "",
  },
  llm: {
    provider: "openai",
    model: "gpt-4o",
    apiKey: "",
    baseUrl: "",
    maxTokens: 2048,
    temperature: 0.1,
  },
  projects: [
    {
      id: "default",
      name: "Default Project",
      repo: {
        projectPath: "",
        remote: "",
        branchPrefix: "auto-fix",
      },
      verifyCommand: "",
    },
  ],
  server: {
    port: 3200,
  },
};
