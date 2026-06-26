import { execSync } from "node:child_process";

/**
 * Commit and push the fix to the remote repository.
 *
 * For MVP:
 * - Creates a git commit with the fix
 * - Pushes to a dedicated branch
 * - In production, this would open a PR instead
 */
export async function commitFix(
  projectPath: string,
  summary: string,
  eventId: string
): Promise<string> {
  const branchName = `auto-fix/${eventId.slice(0, 8)}`;

  try {
    execSync(`git checkout -b ${branchName}`, {
      cwd: projectPath,
      encoding: "utf-8",
    });
  } catch {
    // Branch might already exist, try switching
    try {
      execSync(`git checkout ${branchName}`, {
        cwd: projectPath,
        encoding: "utf-8",
      });
    } catch {
      // Ignore — we'll commit on current branch
    }
  }

  // Stage all changed files
  execSync("git add -A", { cwd: projectPath, encoding: "utf-8" });

  // Commit
  const commitMsg = `[auto-fix] ${summary}\n\nAuto-fix pipeline | Event: ${eventId}`;
  execSync(`git commit -m "${commitMsg}"`, {
    cwd: projectPath,
    encoding: "utf-8",
  });

  // Get commit SHA
  const sha = execSync("git rev-parse HEAD", {
    cwd: projectPath,
    encoding: "utf-8",
  }).trim();

  console.log(`[commit] Committed fix as ${sha} on branch ${branchName}`);

  // Try to push (non-blocking)
  try {
    execSync(`git push origin ${branchName}`, {
      cwd: projectPath,
      encoding: "utf-8",
      timeout: 30_000,
    });
    console.log(`[commit] Pushed branch ${branchName} to origin`);
  } catch (err) {
    console.warn(`[commit] Push failed (remote may not be configured):`, err);
  }

  return sha;
}
