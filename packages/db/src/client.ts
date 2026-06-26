import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { PgliteClient } from "drizzle-orm/pglite";
import * as schema from "./schema.js";

type Db = PgliteDatabase<typeof schema>;

let pgClient: PGlite | null = null;
let dbInstance: Db | null = null;

const CREATE_EVENTS = `
  CREATE TABLE IF NOT EXISTS events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id text NOT NULL,
    error_type text NOT NULL,
    message text NOT NULL,
    stack_trace text NOT NULL,
    source_file text NOT NULL,
    source_line text NOT NULL,
    environment jsonb DEFAULT null,
    raw_event jsonb NOT NULL,
    created_at timestamp DEFAULT now() NOT NULL
  )
`;

const CREATE_FIXES = `
  CREATE TABLE IF NOT EXISTS fixes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES events(id),
    status text NOT NULL DEFAULT 'pending',
    diff text NOT NULL DEFAULT '',
    files text[] NOT NULL DEFAULT '{}',
    summary text NOT NULL DEFAULT '',
    verification_output text,
    commit_sha text,
    error text,
    created_at timestamp DEFAULT now() NOT NULL,
    updated_at timestamp DEFAULT now() NOT NULL
  )
`;

export async function createDb(dataDir?: string): Promise<Db> {
  const client = new PGlite(dataDir);
  await client.waitReady;
  pgClient = client;

  const db = drizzle(client, { schema }) as unknown as Db;
  dbInstance = db;

  // Auto-create tables on first run
  await client.query(CREATE_EVENTS);
  await client.query(CREATE_FIXES);

  return db;
}

export function getDb(): Db {
  if (!dbInstance) throw new Error("Database not initialized. Call createDb() first.");
  return dbInstance;
}