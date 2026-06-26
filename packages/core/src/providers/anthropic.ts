import type { LLMConfig } from "@xartifact/x-tinker-shared";
import type { LLMProvider, ChatMessage } from "../types.js";

/**
 * Anthropic provider implementation
 */
export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  private config!: LLMConfig;

  constructor(config: LLMConfig) {
    this.init(config);
  }

  init(config: LLMConfig): void {
    this.config = config;
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const baseUrl = this.config.baseUrl ?? "https://api.anthropic.com/v1";

    // Anthropic uses a different message format — convert roles
    const systemMsg = messages.find((m) => m.role === "system");
    const otherMsgs = messages.filter((m) => m.role !== "system");

    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: this.config.maxTokens ?? 2048,
      messages: otherMsgs.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    };

    if (systemMsg) {
      body.system = systemMsg.content;
    }

    const res = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const bodyText = await res.text();
      throw new Error(`Anthropic API error (${res.status}): ${bodyText}`);
    }

    const data = (await res.json()) as { content?: { text?: string }[] };
    return data.content?.[0]?.text ?? "";
  }
}
