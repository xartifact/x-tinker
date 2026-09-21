import type { AgentProvider } from "./agent-types.js";
import type { AgentFixRequest, AgentFixResult } from "./agent-types.js";
import { PiAgentProvider } from "./providers/pi-agent.js";
import { AcpAgentProvider } from "./providers/acp-agent.js";
import { ClaudeCodeAgentProvider } from "./providers/claude-code-agent.js";
import { OpenCodeAgentProvider } from "./providers/opencode-agent.js";

/**
 * Registry of available Coding Agent providers.
 *
 * Keys are the names callers pass to `createAgentProvider` / `fixWithAgent`,
 * and each provider's own `name` field repeats its key so a resolved instance
 * can report which provider produced a result.
 *
 * `pi` leads: it edits the working tree directly and reports a real
 * `git diff HEAD`, so it is the default delegate (see DEFAULT_AGENT_PROVIDER).
 * The others remain available as switchable fallbacks.
 */
const AGENT_REGISTRY: Record<string, AgentProviderConstructor> = {
  pi: PiAgentProvider,
  acp: AcpAgentProvider,
  "claude-code": ClaudeCodeAgentProvider,
  opencode: OpenCodeAgentProvider,
};

/** Provider used when a project/global agent config names none. */
export const DEFAULT_AGENT_PROVIDER = "pi";

export interface AgentProviderConstructor {
  new (config: Record<string, string>): AgentProvider;
}

/**
 * Register an Agent provider
 */
export function registerAgentProvider(name: string, ctor: AgentProviderConstructor): void {
  AGENT_REGISTRY[name] = ctor;
}

/**
 * Get an Agent provider instance by name
 */
export function createAgentProvider(name: string, config: Record<string, string> = {}): AgentProvider {
  const Ctor = AGENT_REGISTRY[name];
  if (!Ctor) {
    throw new Error(
      `Unknown agent provider: "${name}". Available: ${Object.keys(AGENT_REGISTRY).join(", ")}`
    );
  }
  const instance = new Ctor(config);
  instance.init(config);
  return instance;
}

/**
 * Agent fixer — convenience wrapper that resolves provider and runs fix
 */
export async function fixWithAgent(
  providerName: string,
  config: Record<string, string>,
  request: AgentFixRequest,
): Promise<AgentFixResult> {
  const provider = createAgentProvider(providerName, config);
  return provider.fix(request);
}

export type { AgentProvider, AgentFixRequest, AgentFixResult } from "./agent-types.js";