import { execSync } from "node:child_process";
import type { ErrorEvent } from "@xartifact/x-tinker-shared";

/**
 * Verify the fix by running the project's configured verify command.
 *
 * The command comes from the project's config (ProjectConfig.verifyCommand)
 * and runs in the project root. It should exit non-zero on failure, e.g.:
 *   "bun test" / "npm test" / "bun run src/index.ts bug1"
 *
 * Policy:
 *  - verifyCommand configured → run it; non-zero exit = verification failed
 *  - no verifyCommand → verification is skipped (returns null); the fix is
 *    committed without automated verification
 *
 * Returns null if verification passes (or is skipped), or an error string.
 */
export async function verifyFix(
  projectPath: string,
  event: ErrorEvent,
  verifyCommand?: string
): Promise<string | null> {
  const cmd = verifyCommand?.trim();
  if (!cmd) {
    console.log(`[verify] Skipped — no verifyCommand configured for project "${event.projectId}"`);
    return null;
  }

  try {
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
