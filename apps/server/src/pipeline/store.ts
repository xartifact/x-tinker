import { getDb, events, fixes } from "@xartifact/x-tinker-db";
import type { events as EventsTable } from "@xartifact/x-tinker-db";
import { eq, desc, inArray } from "drizzle-orm";
import type { ErrorEvent, FixResult } from "@xartifact/x-tinker-shared";

// ─── Event ─────────────────────────────────────────────────────

export async function recordEvent(event: ErrorEvent): Promise<void> {
  const db = getDb();
  const ctx = event.sourceContext ?? { filePath: "unknown", line: 0, before: [], lineContent: "", after: [] };
  await db.insert(events).values({
    projectId: event.projectId,
    errorType: event.errorType,
    message: event.message,
    stackTrace: event.stackTrace,
    sourceFile: ctx.filePath,
    sourceLine: String(ctx.line ?? 0),
    environment: event.environment ?? null,
    rawEvent: event,
  });
}

export async function listEvents(limit = 50): Promise<ErrorEvent[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(events)
    .orderBy(desc(events.createdAt))
    .limit(limit);
  return rows.map((r) => r.rawEvent as unknown as ErrorEvent);
}

export async function getEvent(id: string): Promise<ErrorEvent | null> {
  const db = getDb();
  const rows = await db.select().from(events).where(eq(events.id, id)).limit(1);
  return rows[0] ? (rows[0].rawEvent as unknown as ErrorEvent) : null;
}

// ─── Fix ────────────────────────────────────────────────────────

export async function recordFix(result: FixResult): Promise<void> {
  const db = getDb();
  await db.insert(fixes).values({
    eventId: result.eventId,
    status: result.status,
    diff: result.patch.diff,
    files: result.patch.files,
    summary: result.patch.summary,
    verificationOutput: result.verificationOutput ?? null,
    commitSha: result.commitSha ?? null,
    error: result.error ?? null,
  });
}

export async function listFixes(limit = 50): Promise<FixResult[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(fixes)
    .orderBy(desc(fixes.createdAt))
    .limit(limit);
  return rows.map(toFixResult);
}

function toFixResult(r: typeof fixes.$inferSelect): FixResult {
  return {
    eventId: r.eventId,
    patch: { diff: r.diff, files: r.files, summary: r.summary },
    status: r.status as FixResult["status"],
    verificationOutput: r.verificationOutput ?? undefined,
    commitSha: r.commitSha ?? undefined,
    error: r.error ?? undefined,
  };
}

// ─── Combined ──────────────────────────────────────────────────

export interface EventWithFix {
  event: ErrorEvent;
  fix: FixResult | null;
}

export async function listEventsWithFixes(limit = 50): Promise<EventWithFix[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(events)
    .orderBy(desc(events.createdAt))
    .limit(limit);

  if (rows.length === 0) return [];

  const eventIds = rows.map((r) => r.id);
  const fixRows = await db
    .select()
    .from(fixes)
    .where(inArray(fixes.eventId, eventIds))
    .orderBy(desc(fixes.createdAt));

  const fixByEventId = new Map<string, FixResult>();
  for (const r of fixRows) {
    if (!fixByEventId.has(r.eventId)) {
      fixByEventId.set(r.eventId, toFixResult(r));
    }
  }

  return rows.map((r) => ({
    event: r.rawEvent as unknown as ErrorEvent,
    fix: fixByEventId.get(r.id) ?? null,
  }));
}