import type { LLMConfig } from "@xartifact/x-tinker-shared";
import type { LLMProvider, ChatMessage } from "../types.js";

/**
 * OpenAI provider implementation
 */
export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
  private config!: LLMConfig;

  constructor(config: LLMConfig) {
    this.init(config);
  }

  init(config: LLMConfig): void {
    this.config = config;
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const baseUrl = this.config.baseUrl ?? "https://api.openai.com/v1";

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        max_tokens: this.config.maxTokens ?? 2048,
        temperature: this.config.temperature ?? 0.1,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI API error (${res.status}): ${body}`);
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? "";
  }
}
