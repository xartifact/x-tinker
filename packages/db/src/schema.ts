import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import type { ErrorEvent } from "@xartifact/x-tinker-shared";

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: text("project_id").notNull(),
  errorType: text("error_type").notNull(),
  message: text("message").notNull(),
  stackTrace: text("stack_trace").notNull(),
  sourceFile: text("source_file").notNull(),
  sourceLine: text("source_line").notNull(),
  environment: jsonb("environment").$type<Record<string, string> | null>().default(null),
  rawEvent: jsonb("raw_event").$type<ErrorEvent>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const fixes = pgTable("fixes", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id),
  status: text("status", { enum: ["pending", "applied", "verified", "failed", "rejected"] }).notNull().default("pending"),
  diff: text("diff").notNull().default(""),
  files: text("files").array().notNull().default([]),
  summary: text("summary").notNull().default(""),
  verificationOutput: text("verification_output"),
  commitSha: text("commit_sha"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});