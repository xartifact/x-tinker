import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export interface SourceCodeResult {
  /** Full source file content */
  content: string;
  /** Annotated with line numbers for LLM context */
  annotated: string;
}

/**
 * Read source code surrounding the error location
 *
 * Returns the full file content with line numbers annotated,
 * focusing context around the error line.
 */
export async function readSourceContext(
  projectPath: string,
  filePath: string,
  errorLine: number
): Promise<SourceCodeResult> {
  const fullPath = resolve(projectPath, filePath);

  let content: string;
  try {
    content = await readFile(fullPath, "utf-8");
  } catch (err) {
    throw new Error(
      `Cannot read source file at ${fullPath}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const lines = content.split("\n");

  // Annotate with line numbers
  const lineNumWidth = String(lines.length).length;
  const annotated = lines
    .map((line, i) => {
      const lineNum = String(i + 1).padStart(lineNumWidth);
      const marker = i + 1 === errorLine ? " >>> " : "     ";
      return `${lineNum}${marker}${line}`;
    })
    .join("\n");

  return { content, annotated };
}
