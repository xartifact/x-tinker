import type { ErrorEvent } from "./types.js";

/**
 * Validate an incoming error event payload
 * Returns null if valid, or an error message string
 */
export function validateErrorEvent(data: unknown): string | null {
  if (!data || typeof data !== "object") {
    return "Payload must be an object";
  }

  const event = data as Record<string, unknown>;

  if (!event.projectId || typeof event.projectId !== "string") {
    return "Missing or invalid field: projectId (string)";
  }
  if (!event.errorType || typeof event.errorType !== "string") {
    return "Missing or invalid field: errorType (string)";
  }
  if (!event.message || typeof event.message !== "string") {
    return "Missing or invalid field: message (string)";
  }
  if (!event.stackTrace || typeof event.stackTrace !== "string") {
    return "Missing or invalid field: stackTrace (string)";
  }
  if (!event.timestamp || typeof event.timestamp !== "string") {
    return "Missing or invalid field: timestamp (string)";
  }

  return null;
}

/**
 * Create a new error event with generated ID
 */
export function createErrorEvent(partial: Omit<ErrorEvent, "id" | "timestamp"> & { id?: string; timestamp?: string }): ErrorEvent {
  return {
    ...partial,
    id: partial.id ?? crypto.randomUUID(),
    timestamp: partial.timestamp ?? new Date().toISOString(),
  };
}
