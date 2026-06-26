import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { FixPatch } from "@xartifact/x-tinker-shared";

/**
 * Apply a unified diff patch to the source file
 *
 * For MVP: simple line-based patch application.
 * In production, use `git apply` or a proper diff library.
 */
export async function applyPatch(
  projectPath: string,
  patch: FixPatch
): Promise<void> {
  for (const filePath of patch.files) {
    const fullPath = resolve(projectPath, filePath);
    const newContent = applyUnifiedDiff(fullPath, patch.diff);
    if (newContent !== null) {
      await writeFile(fullPath, newContent, "utf-8");
      console.log(`[apply-patch] Applied patch to ${fullPath}`);
    }
  }
}

/**
 * Simple unified diff parser and applier
 *
 * Parses the diff header to find the target file and hunk ranges,
 * then applies the changes to the in-memory file content.
 */
function applyUnifiedDiff(filePath: string, diff: string): string | null {
  const lines = diff.split("\n");
  if (lines.length < 2) return null;

  // Read the current file content
  const fs = require("node:fs");
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, "utf-8");
  const contentLines = content.split("\n");

  // Parse hunks
  let currentOffset = 0;
  const hunks: { start: number; lines: string[]; removeCount: number; addLines: string[] }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const hunkHeader = lines[i].match(/^@@ -(\d+),?(\d*)? \+(\d+),?(\d*)? @@/);
    if (!hunkHeader) continue;

    const origStart = parseInt(hunkHeader[1], 10);
    const origCount = hunkHeader[2] ? parseInt(hunkHeader[2], 10) : 1;
    const newStart = parseInt(hunkHeader[3], 10);

    const hunkLines: string[] = [];
    let j = i + 1;
    while (j < lines.length && !lines[j].startsWith("@@")) {
      hunkLines.push(lines[j]);
      j++;
    }

    let removeCount = 0;
    const addLines: string[] = [];
    for (const hl of hunkLines) {
      if (hl.startsWith("-")) removeCount++;
      else if (hl.startsWith("+")) addLines.push(hl.slice(1));
    }

    hunks.push({
      start: origStart - 1, // 0-indexed
      lines: hunkLines,
      removeCount,
      addLines,
    });
  }

  // Apply hunks in reverse order (to preserve line numbers)
  let result = [...contentLines];
  for (const hunk of hunks.reverse()) {
    const start = hunk.start + currentOffset;
    if (hunk.removeCount > 0) {
      result.splice(start, hunk.removeCount, ...hunk.addLines);
    } else {
      // Insert-only hunk
      result.splice(start, 0, ...hunk.addLines);
    }
  }

  return result.join("\n");
}
