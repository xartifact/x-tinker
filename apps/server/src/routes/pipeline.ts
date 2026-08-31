import { Hono } from "hono";
import { validateErrorEvent, createErrorEvent } from "@xartifact/x-tinker-shared";
import { runPipeline } from "../pipeline/index.js";
import { recordEvent } from "../pipeline/store.js";

export const pipelineRouter = new Hono();

/**
 * POST /api/events
 *
 * Receive an error event from Project A, persist it, and trigger the fix pipeline.
 */
pipelineRouter.post("/events", async (c) => {
  const body = await c.req.json();

  const validationError = validateErrorEvent(body);
  if (validationError) {
    return c.json({ error: validationError }, 400);
  }

  // Normalize: guarantee id (uuid) + timestamp exist, so events.id matches
  // rawEvent.id and fixes.event_id stays a valid foreign key
  const event = createErrorEvent(body as Parameters<typeof createErrorEvent>[0]);
  console.log(`[server] Received error event: ${event.id} — ${event.errorType}: ${event.message}`);

  // Persist immediately
  await recordEvent(event);

  // Run the fix pipeline (async)
  runPipeline(event)
    .then((result) => {
      console.log(`[server] Pipeline result for ${event.id}:`, result.status);
    })
    .catch((err) => {
      console.error(`[server] Pipeline failed for ${event.id}:`, err);
    });

  return c.json({
    eventId: event.id,
    status: "accepted",
    message: "Error event received, fix pipeline started",
  }, 202);
});
