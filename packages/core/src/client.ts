import type { LLMConfig } from "@xartifact/x-tinker-shared";
import type { LLMProvider, ChatMessage } from "./types.js";
import { OpenAIProvider } from "./providers/openai.js";
import { AnthropicProvider } from "./providers/anthropic.js";
import { MockProvider } from "./providers/mock.js";

/**
 * Registry of available LLM providers
 */
const PROVIDER_REGISTRY: Record<string, new (config: LLMConfig) => LLMProvider> = {
  openai: OpenAIProvider,
  anthropic: AnthropicProvider,
  mock: MockProvider,
};

/**
 * Register a custom provider
 */
export function registerProvider(name: string, ctor: new (config: LLMConfig) => LLMProvider): void {
  PROVIDER_REGISTRY[name] = ctor;
}

/**
 * LLM Client — model-agnostic chat client
 *
 * Usage:
 * ```ts
 * const client = new LLMClient({ provider: "openai", model: "gpt-4o", apiKey: "sk-..." });
 * const reply = await client.chat([{ role: "user", content: "Hello" }]);
 * ```
 */
export class LLMClient {
  private provider: LLMProvider;

  constructor(config: LLMConfig) {
    const ProviderCtor = PROVIDER_REGISTRY[config.provider];
    if (!ProviderCtor) {
      throw new Error(
        `Unknown LLM provider: "${config.provider}". Available: ${Object.keys(PROVIDER_REGISTRY).join(", ")}`
      );
    }
    this.provider = new ProviderCtor(config);
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    return this.provider.chat(messages);
  }

  get providerName(): string {
    return this.provider.name;
  }
}
