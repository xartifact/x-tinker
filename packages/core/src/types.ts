import type { LLMConfig } from "@xartifact/x-tinker-shared";

/**
 * Chat message roles
 */
export type MessageRole = "system" | "user" | "assistant";

/**
 * A single chat message
 */
export interface ChatMessage {
  role: MessageRole;
  content: string;
}

/**
 * LLM provider interface — implement this to support any model
 */
export interface LLMProvider {
  /** Provider name (e.g., "openai", "anthropic") */
  readonly name: string;
  /** Send a chat completion request */
  chat(messages: ChatMessage[]): Promise<string>;
  /** Initialize from config */
  init(config: LLMConfig): void;
}

/**
 * Provider constructor type
 */
export interface LLMProviderConstructor {
  new (config: LLMConfig): LLMProvider;
  readonly providerName: string;
}

/**
 * Patch generation prompt context
 */
export interface PatchPromptContext {
  /** Error type (TypeError, ReferenceError, etc.) */
  errorType: string;
  /** Error message */
  errorMessage: string;
  /** Full stack trace */
  stackTrace: string;
  /** Source file path */
  filePath: string;
  /** Source code surrounding the error (with line numbers) */
  sourceCode: string;
  /** The error line number */
  errorLine: number;
}
