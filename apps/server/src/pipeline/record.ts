import { appendFile, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { FixResult } from "@xartifact/x-tinker-shared";

const RECORDS_FILE = "fix-records.jsonl";

/**
 * Record a fix result for audit and feedback loop
 *
 * MVP: simple JSONL file. In production: DB.
 */
export async function recordResult(result: FixResult): Promise<void> {
  const recordsPath = resolve(process.cwd(), RECORDS_FILE);

  try {
    await appendFile(recordsPath, JSON.stringify(result) + "\n", "utf-8");
    console.log(`[record] Result recorded for ${result.eventId}: ${result.status}`);
  } catch (err) {
    console.error(`[record] Failed to write result:`, err);
  }
}

/**
 * Get all recorded fix results
 */
export async function getRecords(): Promise<FixResult[]> {
  const recordsPath = resolve(process.cwd(), RECORDS_FILE);

  try {
    const content = await readFile(recordsPath, "utf-8");
    return content
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}
