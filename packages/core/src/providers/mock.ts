import type { LLMConfig } from "@xartifact/x-tinker-shared";
import type { LLMProvider, ChatMessage } from "../types.js";

/**
 * Mock provider for end-to-end testing without a real LLM.
 *
 * Recognizes the demo-app bug1 (null reference on user.profile.displayName)
 * and returns a pre-written unified diff to fix it.
 */
export class MockProvider implements LLMProvider {
  readonly name = "mock";

  constructor(_config: LLMConfig) {}

  init(_config: LLMConfig): void {}

  async chat(messages: ChatMessage[]): Promise<string> {
    const lastMsg = messages[messages.length - 1]?.content ?? "";

    // Detect bug1: null reference on user.profile
    if (lastMsg.includes("user.profile.displayName") || lastMsg.includes("getUserDisplayName")) {
      return this.fixBug1Diff();
    }

    // Detect bug2: empty array access
    if (lastMsg.includes("getLastItem") || lastMsg.includes(".toFixed(2)")) {
      return this.fixBug2Diff();
    }

    throw new Error(`[MockProvider] Unknown error pattern — can't generate mock fix. Input:\n${lastMsg.slice(0, 200)}`);
  }

  private fixBug1Diff(): string {
    return [
      "```diff",
      "--- a/apps/demo-app/src/index.ts",
      "+++ b/apps/demo-app/src/index.ts",
      "@@ -38,3 +38,3 @@ function getUserDisplayName(user: User): string {",
      "   // BUG: user.profile might be undefined",
      "-  return user.profile.displayName ?? user.name;",
      "+  return user.profile?.displayName ?? user.name;",
      "```",
    ].join("\n");
  }

  private fixBug2Diff(): string {
    return [
      "```diff",
      "--- a/apps/demo-app/src/index.ts",
      "+++ b/apps/demo-app/src/index.ts",
      "@@ -51,3 +51,5 @@ function getLastItem<T>(items: T[]): T | undefined {",
      "   // but the function signature says it returns T, not T | undefined",
      "-  return items[items.length - 1];",
      "+  return items.length > 0 ? items[items.length - 1] : undefined;",
      "```",
    ].join("\n");
  }
}
