export type { LLMProvider } from "./types.js";
export type { ChatMessage, PatchPromptContext } from "./types.js";
export { LLMClient } from "./client.js";
export { generatePatch, parseDiff, buildUserPrompt, SYSTEM_PROMPT } from "./patch-generator.js";
export { OpenAIProvider } from "./providers/openai.js";
export { AnthropicProvider } from "./providers/anthropic.js";

// Agent (ACP/A2A) exports
export type { AgentProvider, AgentFixRequest, AgentFixResult } from "./agent-types.js";
export {
  registerAgentProvider,
  createAgentProvider,
  fixWithAgent,
  DEFAULT_AGENT_PROVIDER,
} from "./agent-registry.js";
export { PiAgentProvider } from "./providers/pi-agent.js";
export { AcpAgentProvider } from "./providers/acp-agent.js";
export { ClaudeCodeAgentProvider } from "./providers/claude-code-agent.js";
export { OpenCodeAgentProvider } from "./providers/opencode-agent.js";
