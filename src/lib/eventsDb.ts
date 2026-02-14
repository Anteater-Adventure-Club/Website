import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { upcomingEvents } from "@/data/upcomingEvents";

type EventStatus = "upcoming" | "past";

type EventRow = {
  id: string;
  name: string;
  date: string;
  description: string;
  image_path: string;
  sign_up_link: string | null;
  event_type: AACEvent["type"] | null;
  status: EventStatus;
};

type CreateEventInput = Omit<AACEvent, "id">;
type UpdateEventInput = Partial<Omit<AACEvent, "id">>;
type TableInfoRow = {
  name: string;
  dflt_value: string | null;
};

const DB_DIRECTORY = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIRECTORY, "events.sqlite");
const SEEDED_EVENTS: (AACEvent & { status: EventStatus })[] = [
  ...upcomingEvents.map((event) => ({ ...event, status: "upcoming" as const })),
];

const globalForDb = globalThis as typeof globalThis & {
  aacEventsDb?: DatabaseSync;
  aacEventsInitialized?: boolean;
};

function getDb(): DatabaseSync {
  if (!globalForDb.aacEventsDb) {
    fs.mkdirSync(DB_DIRECTORY, { recursive: true });
    const database = new DatabaseSync(DB_PATH);
    database.exec(`
      PRAGMA busy_timeout = 5000;
      PRAGMA journal_mode = WAL;
    `);
    globalForDb.aacEventsDb = database;
  }

  return globalForDb.aacEventsDb;
}

function createSchema(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY NOT NULL DEFAULT (
        lower(
          substr(hex(randomblob(16)),1,8) || '-' ||
          substr(hex(randomblob(16)),9,4) || '-' ||
          substr(hex(randomblob(16)),13,4) || '-' ||
          substr(hex(randomblob(16)),17,4) || '-' ||
          substr(hex(randomblob(16)),21,12)
        )
      ),
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      image_path TEXT NOT NULL DEFAULT '',
      sign_up_link TEXT,
      event_type TEXT,
      status TEXT NOT NULL CHECK(status IN ('upcoming', 'past')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TRIGGER IF NOT EXISTS events_fill_empty_id
    AFTER INSERT ON events
    FOR EACH ROW
    WHEN NEW.id = ''
    BEGIN
      UPDATE events
      SET id = lower(
        substr(hex(randomblob(16)),1,8) || '-' ||
        substr(hex(randomblob(16)),9,4) || '-' ||
        substr(hex(randomblob(16)),13,4) || '-' ||
        substr(hex(randomblob(16)),17,4) || '-' ||
        substr(hex(randomblob(16)),21,12)
      )
      WHERE rowid = NEW.rowid;
    END;
  `);
}

function migrateEventsSchemaIfNeeded(database: DatabaseSync) {
  const tableInfo = database
    .prepare("PRAGMA table_info(events)")
    .all() as TableInfoRow[];

  const idColumn = tableInfo.find((column) => column.name === "id");
  const hasIdDefault = Boolean(idColumn?.dflt_value);

  if (hasIdDefault) {
    return;
  }

  database.exec(`
    ALTER TABLE events RENAME TO events_old;

    CREATE TABLE events (
      id TEXT PRIMARY KEY NOT NULL DEFAULT (
        lower(
          substr(hex(randomblob(16)),1,8) || '-' ||
          substr(hex(randomblob(16)),9,4) || '-' ||
          substr(hex(randomblob(16)),13,4) || '-' ||
          substr(hex(randomblob(16)),17,4) || '-' ||
          substr(hex(randomblob(16)),21,12)
        )
      ),
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      image_path TEXT NOT NULL DEFAULT '',
      sign_up_link TEXT,
      event_type TEXT,
      status TEXT NOT NULL CHECK(status IN ('upcoming', 'past')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    INSERT INTO events (
      id, name, date, description, image_path, sign_up_link, event_type, status, created_at, updated_at
    )
    SELECT
      CASE
        WHEN id IS NULL OR id = '' THEN lower(
          substr(hex(randomblob(16)),1,8) || '-' ||
          substr(hex(randomblob(16)),9,4) || '-' ||
          substr(hex(randomblob(16)),13,4) || '-' ||
          substr(hex(randomblob(16)),17,4) || '-' ||
          substr(hex(randomblob(16)),21,12)
        )
        ELSE id
      END,
      name, date, description, image_path, sign_up_link, event_type, status, created_at, updated_at
    FROM events_old;

    DROP TABLE events_old;

    CREATE TRIGGER IF NOT EXISTS events_fill_empty_id
    AFTER INSERT ON events
    FOR EACH ROW
    WHEN NEW.id = ''
    BEGIN
      UPDATE events
      SET id = lower(
        substr(hex(randomblob(16)),1,8) || '-' ||
        substr(hex(randomblob(16)),9,4) || '-' ||
        substr(hex(randomblob(16)),13,4) || '-' ||
        substr(hex(randomblob(16)),17,4) || '-' ||
        substr(hex(randomblob(16)),21,12)
      )
      WHERE rowid = NEW.rowid;
    END;
  `);
}

function seedInitialEvents(database: DatabaseSync) {
  const insert = database.prepare(`
    INSERT OR IGNORE INTO events (
      id, name, date, description, image_path, sign_up_link, event_type, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seed = SEEDED_EVENTS;

  try {
    for (const event of seed) {
      insert.run(
        event.id,
        event.name,
        event.date,
        event.description,
        event.imagePath,
        event.signUpLink ?? null,
        event.type ?? null,
        event.status,
      );
    }
  } catch (error) {
    const isLocked =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "ERR_SQLITE_ERROR";

    if (!isLocked) {
      throw error;
    }
  }
}

function ensureInitialized() {
  if (globalForDb.aacEventsInitialized) {
    return;
  }

  const database = getDb();
  createSchema(database);
  migrateEventsSchemaIfNeeded(database);
  seedInitialEvents(database);
  globalForDb.aacEventsInitialized = true;
}

function normalizeStatus(status?: string): EventStatus {
  return status === "past" ? "past" : "upcoming";
}

function mapRow(row: EventRow): AACEvent {
  return {
    id: row.id,
    name: row.name,
    date: row.date,
    description: row.description,
    imagePath: row.image_path,
    signUpLink: row.sign_up_link ?? undefined,
    type: row.event_type ?? undefined,
    status: row.status,
  };
}

function eventTimestamp(event: AACEvent): number {
  const timestamp = Date.parse(event.date);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function sortEvents(events: AACEvent[], status?: "upcoming" | "past"): AACEvent[] {
  if (status === "past") {
    return [...events].sort((a, b) => eventTimestamp(b) - eventTimestamp(a));
  }

  if (status === "upcoming") {
    return [...events].sort((a, b) => eventTimestamp(a) - eventTimestamp(b));
  }

  return events;
}

export function listEvents(status?: string): AACEvent[] {
  const normalizedStatus =
    status === "upcoming" || status === "past" ? status : undefined;
  const fallback = normalizedStatus
    ? SEEDED_EVENTS.filter((event) => event.status === normalizedStatus)
    : SEEDED_EVENTS;

  if (!fs.existsSync(DB_PATH)) {
    return sortEvents(fallback, normalizedStatus);
  }

  try {
    const db = getDb();
    const stmt = normalizedStatus
      ? db.prepare(`
          SELECT id, name, date, description, image_path, sign_up_link, event_type, status
          FROM events
          WHERE status = ?
          ORDER BY created_at DESC
        `)
      : db.prepare(`
          SELECT id, name, date, description, image_path, sign_up_link, event_type, status
          FROM events
          ORDER BY created_at DESC
        `);

    const rows = normalizedStatus
      ? (stmt.all(normalizedStatus) as EventRow[])
      : (stmt.all() as EventRow[]);

    return sortEvents(rows.map(mapRow), normalizedStatus);
  } catch {
    return sortEvents(fallback, normalizedStatus);
  }
}

export function getEventById(id: string): AACEvent | null {
  if (!fs.existsSync(DB_PATH)) {
    return SEEDED_EVENTS.find((event) => event.id === id) ?? null;
  }

  try {
    const row = getDb()
      .prepare(`
        SELECT id, name, date, description, image_path, sign_up_link, event_type, status
        FROM events
        WHERE id = ?
      `)
      .get(id) as EventRow | undefined;

    return row ? mapRow(row) : null;
  } catch {
    return SEEDED_EVENTS.find((event) => event.id === id) ?? null;
  }
}

export function createEvent(payload: CreateEventInput): AACEvent {
  ensureInitialized();
  const db = getDb();
  const id = crypto.randomUUID();
  const status = normalizeStatus(payload.status);

  db.prepare(`
    INSERT INTO events (
      id, name, date, description, image_path, sign_up_link, event_type, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    payload.name,
    payload.date,
    payload.description,
    payload.imagePath,
    payload.signUpLink ?? null,
    payload.type ?? null,
    status,
  );

  const created = getEventById(id);
  if (!created) {
    throw new Error("Failed to create event");
  }

  return created;
}

export function updateEvent(id: string, payload: UpdateEventInput): AACEvent | null {
  ensureInitialized();
  const db = getDb();
  const existing = getEventById(id);
  if (!existing) {
    return null;
  }

  const nextStatus = payload.status
    ? normalizeStatus(payload.status)
    : existing.status ?? "upcoming";

  const merged: AACEvent = {
    ...existing,
    ...payload,
    id,
    status: nextStatus,
  };

  db.prepare(`
    UPDATE events
    SET
      name = ?,
      date = ?,
      description = ?,
      image_path = ?,
      sign_up_link = ?,
      event_type = ?,
      status = ?
    WHERE id = ?
  `).run(
    merged.name,
    merged.date,
    merged.description,
    merged.imagePath,
    merged.signUpLink ?? null,
    merged.type ?? null,
    merged.status,
    id,
  );

  return getEventById(id);
}

export function deleteEvent(id: string): boolean {
  ensureInitialized();
  const db = getDb();
  const result = db.prepare("DELETE FROM events WHERE id = ?").run(id) as {
    changes?: number;
  };

  return (result.changes ?? 0) > 0;
}
