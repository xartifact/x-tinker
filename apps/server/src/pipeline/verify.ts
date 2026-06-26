import { execSync } from "node:child_process";
import type { ErrorEvent } from "@xartifact/x-tinker-shared";

/**
 * Verify the fix by running the project's build or test command.
 *
 * For MVP:
 * - If it's the demo-app, run `bun run src/index.ts bug1` to verify
 * - In production, this would run the project's full test suite
 *
 * Returns null if verification passes, or an error string if it fails.
 */
export async function verifyFix(
  projectPath: string,
  event: ErrorEvent
): Promise<string | null> {
  const scriptPath = getScriptPath(event);

  if (!scriptPath) {
    // No specific verification script for this project
    return "No verification command configured for this project";
  }

  // Get the bug scenario from the event
  const bugId = extractBugId(event);

  try {
    const cmd = bugId
      ? `${scriptPath} ${bugId}`
      : scriptPath;

    const output = execSync(cmd, {
      cwd: projectPath,
      timeout: 30_000,
      encoding: "utf-8",
    });

    console.log(`[verify] Verification output:`, output.slice(0, 500));
    return null; // Passed
  } catch (err) {
    const stderr = err instanceof Error ? err.message : String(err);
    return `Verification failed:\n${stderr}`;
  }
}

/**
 * Get the verification script path based on the project/event
 */
function getScriptPath(event: ErrorEvent): string | null {
  if (event.projectId === "demo-app") {
    return "bun run src/index.ts";
  }
  return null;
}

/**
 * Extract a bug scenario identifier from the error event
 * e.g., stack trace mentions "bug1" → returns "bug1"
 */
function extractBugId(event: ErrorEvent): string | null {
  // Check trace for bug scenario patterns
  const traceMatch = event.stackTrace.match(/bug(\d+)/);
  return traceMatch ? traceMatch[0] : null;
}
