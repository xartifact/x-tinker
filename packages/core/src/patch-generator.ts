import type { FixPatch } from "@xartifact/x-tinker-shared";
import type { LLMClient } from "./client.js";
import type { PatchPromptContext, ChatMessage } from "./types.js";

/**
 * System prompt for the fix agent
 */
const SYSTEM_PROMPT = `You are an expert debugger and software engineer. Given an error report and source code, your task is to:

1. Analyze the root cause of the error
2. Generate a minimal fix in unified diff format

Rules:
- ONLY output the diff — no explanations, no commentary
- The diff must be valid unified diff format (like \`diff -u\`)
- Fix the root cause, not just the symptom
- Keep changes minimal — change ONLY what's needed
- Consider edge cases and type safety
- Output the full diff between the original and fixed file`;

/**
 * Generate the user prompt for a fix request
 */
function buildUserPrompt(ctx: PatchPromptContext): string {
  return `## Error Report
- Type: ${ctx.errorType}
- Message: ${ctx.errorMessage}
- File: ${ctx.filePath}:${ctx.errorLine}

## Stack Trace
\`\`\`
${ctx.stackTrace}
\`\`\`

## Source Code (with line numbers)
\`\`\`
${ctx.sourceCode}
\`\`\`

Generate a unified diff to fix this error.`;
}

/**
 * Parse a unified diff from LLM output
 */
function parseDiff(llmOutput: string): FixPatch | null {
  // Extract diff blocks from markdown code fences or raw text
  const diffMatch = llmOutput.match(/```(?:diff)?\s*\n([\s\S]*?)```/);
  const diff = diffMatch ? diffMatch[1].trim() : llmOutput.trim();

  if (!diff || !diff.includes("---") || !diff.includes("+++")) {
    return null;
  }

  // Extract affected file names from the diff header
  const filePattern = /\+\+\+\s+(?:b\/)?(.+)/;
  const fileMatch = diff.match(filePattern);
  const files = fileMatch ? [fileMatch[1].trim()] : [];

  return {
    diff,
    files,
    summary: `Fix for error`,
  };
}

/**
 * Generate a fix patch for a given error context using the LLM
 */
export async function generatePatch(
  client: LLMClient,
  context: PatchPromptContext
): Promise<FixPatch> {
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserPrompt(context) },
  ];

  const response = await client.chat(messages);
  const patch = parseDiff(response);

  if (!patch) {
    throw new Error(
      "Failed to parse LLM output as a valid diff. Response:\n" + response
    );
  }

  patch.summary = `Fix ${context.errorType}: ${context.errorMessage}`;
  return patch;
}

export { buildUserPrompt, parseDiff, SYSTEM_PROMPT };
