/**
 * Configuration for the ErrorReporter
 */
export interface ErrorReporterConfig {
  /** URL of the x-tinker server (e.g., http://localhost:3200) */
  serverUrl: string;
  /** Project identifier */
  projectId: string;
  /** GitHub repository info (optional) */
  repository?: {
    owner: string;
    name: string;
    commitSha: string;
    branch: string;
  };
  /** Environment info (optional) — merged into ErrorEvent.environment */
  environment?: Record<string, string>;
  /**
   * Per-request metadata injected at report time.
   * Merged into ErrorEvent.environment alongside the static `environment` field.
   * Typical values: request path, method, requestId, route.
   */
  metadata?: Record<string, string>;
}
