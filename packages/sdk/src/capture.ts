import { ErrorReporter } from "./reporter.js";
import type { ErrorReporterConfig } from "./types.js";

/**
 * Capture a single error and report it
 */
export async function captureError(
  config: ErrorReporterConfig,
  error: Error,
  sourceFile?: string
): Promise<void> {
  const reporter = new ErrorReporter(config);
  await reporter.report(error, sourceFile);
}

/**
 * Install global error handlers to capture unhandled errors
 * Supports both Node.js (process) and browser (window) environments
 */
export function captureUnhandledErrors(config: ErrorReporterConfig): () => void {
  const reporter = new ErrorReporter(config);
  const cleanup: (() => void)[] = [];

  const handleUncaught = async (error: Error) => {
    console.error("[error-sdk] Uncaught error:", error);
    await reporter.report(error);
  };

  const handleUnhandledRejection = async (reason: unknown) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    console.error("[error-sdk] Unhandled rejection:", error);
    await reporter.report(error);
  };

  // Node.js / Bun process handlers
  if (typeof process !== "undefined" && typeof process.on === "function") {
    const onUncaught = (err: Error) => { handleUncaught(err); };
    const onRejection = (reason: unknown) => { handleUnhandledRejection(reason); };

    process.on("uncaughtException", onUncaught);
    process.on("unhandledRejection", onRejection);

    cleanup.push(() => {
      process.off("uncaughtException", onUncaught);
      process.off("unhandledRejection", onRejection);
    });
  }

  // Browser window handlers — access via globalThis to avoid DOM type deps
  const g = globalThis as Record<string, unknown>;
  if (typeof g.addEventListener === "function") {
    const onError = (event: unknown) => {
      const evt = event as { error?: Error; message?: string };
      handleUncaught(evt.error ?? new Error(evt.message ?? "Unknown error"));
    };
    const onRejection = (event: unknown) => {
      const evt = event as { reason: unknown };
      handleUnhandledRejection(evt.reason);
    };

    g.addEventListener("error", onError);
    g.addEventListener("unhandledrejection", onRejection);

    cleanup.push(() => {
      if (typeof g.removeEventListener === "function") {
        g.removeEventListener("error", onError);
        g.removeEventListener("unhandledrejection", onRejection);
      }
    });
  }

  return () => {
    for (const fn of cleanup) fn();
  };
}
