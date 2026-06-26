import type { AgentProvider } from "./agent-types.js";
import type { AgentFixRequest, AgentFixResult } from "./agent-types.js";
import { AcpAgentProvider } from "./providers/acp-agent.js";

/**
 * Registry of available Coding Agent providers
 */
const AGENT_REGISTRY: Record<string, AgentProviderConstructor> = {
  acp: AcpAgentProvider,
};

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