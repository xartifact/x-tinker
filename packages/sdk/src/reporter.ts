import type { ErrorEvent } from "@xartifact/x-tinker-shared";
import { createErrorEvent } from "@xartifact/x-tinker-shared";
import type { ErrorReporterConfig } from "./types.js";

/**
 * Error reporter — captures errors and reports them to the x-tinker server
 */
export class ErrorReporter {
  private config: ErrorReporterConfig;

  constructor(config: ErrorReporterConfig) {
    this.config = config;
  }

  /**
   * Report an error event to the x-tinker server.
   * @param metadata - Per-request context (path, method, requestId) merged into environment
   */
  async report(
    error: Error,
    sourceFile?: string,
    metadata?: Record<string, string>,
  ): Promise<{ eventId: string; status: number } | null> {
    try {
      const event = this.buildEvent(error, sourceFile, metadata);
      return await this.send(event);
    } catch (err) {
      console.error("[x-tinker] Failed to report error:", err);
      return null;
    }
  }

  /**
   * Build an ErrorEvent from a runtime error
   */
  private buildEvent(error: Error, sourceFile?: string, metadata?: Record<string, string>): ErrorEvent {
    const stackTrace = error.stack ?? "";
    const topFrame = this.parseTopFrame(stackTrace);

    return createErrorEvent({
      projectId: this.config.projectId,
      errorType: error.name,
      message: error.message,
      stackTrace,
      frames: topFrame ? [topFrame] : [],
      sourceContext: {
        filePath: sourceFile ?? topFrame?.file ?? "unknown",
        line: topFrame?.line ?? 0,
        before: [],
        lineContent: "",
        after: [],
      },
      repository: this.config.repository,
      environment: {
        ...this.config.environment,
        ...this.config.metadata,
        ...metadata,
      },
      severity: "medium",
    });
  }

  /**
   * Parse the top frame from a stack trace string
   */
  private parseTopFrame(stackTrace: string) {
    const lines = stackTrace.split("\n");
    for (const line of lines) {
      // Bun/Node format: "    at functionName (/path/file.ts:10:5)"
      // V8/Chrome format: "    at Object.<anonymous> (/path/file.ts:10:5)"
      const match = line.match(/at\s+(?:.*?\s+)?\(?(.+?):(\d+):(\d+)\)?$/);
      if (match) {
        return {
          file: match[1],
          line: parseInt(match[2], 10),
          column: parseInt(match[3], 10),
        };
      }
    }
    return null;
  }

  /**
   * Send the event to the x-tinker server
   */
  private async send(event: ErrorEvent): Promise<{ eventId: string; status: number }> {
    const res = await fetch(`${this.config.serverUrl}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });

    return { eventId: event.id, status: res.status };
  }
}
