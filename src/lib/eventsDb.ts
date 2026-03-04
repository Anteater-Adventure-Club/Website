import { upcomingEvents } from "@/data/upcomingEvents";
import { pastEvents } from "@/data/pastEvents";

type EventStatus = "upcoming" | "past";

type CreateEventInput = Omit<AACEvent, "id">;
type UpdateEventInput = Partial<Omit<AACEvent, "id">>;

type SupabaseEventRow = {
  id: string;
  name: string;
  date: string;
  description: string;
  image_path: string;
  sign_up_link: string | null;
  event_type: AACEvent["type"] | null;
  status: EventStatus;
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EVENTS_TABLE = process.env.EVENTS_TABLE ?? "events";

const SEEDED_UPCOMING_EVENTS: AACEvent[] = upcomingEvents.map((event) => ({
  ...event,
  status: "upcoming",
}));

const SEEDED_PAST_EVENTS: AACEvent[] = pastEvents.map((event) => ({
  ...event,
  status: "past",
}));

const SEEDED_EVENTS: AACEvent[] = [
  ...SEEDED_UPCOMING_EVENTS,
  ...SEEDED_PAST_EVENTS,
];

function hasSupabaseConfig(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function ensureSupabaseConfig() {
  if (!hasSupabaseConfig()) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
}

function supabaseHeaders(extra: Record<string, string> = {}) {
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_SERVICE_ROLE_KEY as string,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY as string}`,
    ...extra,
  };
}

function normalizeStatus(status?: string): EventStatus {
  return status === "past" ? "past" : "upcoming";
}

function toEvent(row: SupabaseEventRow): AACEvent {
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

function parseMonth(month?: string): { year: number; monthIndex: number } | null {
  if (!month) {
    return null;
  }

  const matched = /^(\d{4})-(\d{2})$/.exec(month);
  if (!matched) {
    return null;
  }

  const year = Number(matched[1]);
  const monthNumber = Number(matched[2]);
  if (monthNumber < 1 || monthNumber > 12) {
    return null;
  }

  return { year, monthIndex: monthNumber - 1 };
}

function filterEventsByMonth(events: AACEvent[], month?: string): AACEvent[] {
  const parsedMonth = parseMonth(month);
  if (!parsedMonth) {
    return events;
  }

  return events.filter((event) => {
    const eventDate = new Date(event.date);
    return (
      !Number.isNaN(eventDate.getTime()) &&
      eventDate.getFullYear() === parsedMonth.year &&
      eventDate.getMonth() === parsedMonth.monthIndex
    );
  });
}

async function supabaseFetch(path: string, init?: RequestInit): Promise<Response> {
  ensureSupabaseConfig();
  const base = SUPABASE_URL as string;
  return fetch(`${base}/rest/v1/${path}`, init);
}

function fallbackEvents(status?: string, month?: string): AACEvent[] {
  const normalizedStatus =
    status === "upcoming" || status === "past" ? status : undefined;
  const fallback = normalizedStatus
    ? SEEDED_EVENTS.filter((event) => event.status === normalizedStatus)
    : SEEDED_EVENTS;

  return sortEvents(filterEventsByMonth(fallback, month), normalizedStatus);
}

export async function listEvents(status?: string, month?: string): Promise<AACEvent[]> {
  const normalizedStatus =
    status === "upcoming" || status === "past" ? status : undefined;

  if (!hasSupabaseConfig()) {
    return fallbackEvents(normalizedStatus, month);
  }

  const filters: string[] = [
    "select=id,name,date,description,image_path,sign_up_link,event_type,status",
  ];

  if (normalizedStatus) {
    filters.push(`status=eq.${encodeURIComponent(normalizedStatus)}`);
    filters.push(`order=date.${normalizedStatus === "past" ? "desc" : "asc"}`);
  } else {
    filters.push("order=date.desc");
  }

  const parsedMonth = parseMonth(month);
  if (parsedMonth) {
    const monthStart = `${parsedMonth.year}-${String(parsedMonth.monthIndex + 1).padStart(2, "0")}-01`;
    const nextMonthDate = new Date(parsedMonth.year, parsedMonth.monthIndex + 1, 1);
    const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}-01`;
    filters.push(`date=gte.${monthStart}`);
    filters.push(`date=lt.${nextMonth}`);
  }

  const response = await supabaseFetch(`${EVENTS_TABLE}?${filters.join("&")}`, {
    headers: supabaseHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    return fallbackEvents(normalizedStatus, month);
  }

  const rows = (await response.json()) as SupabaseEventRow[];
  return sortEvents(rows.map(toEvent), normalizedStatus);
}

export async function getEventById(id: string): Promise<AACEvent | null> {
  if (!hasSupabaseConfig()) {
    return SEEDED_EVENTS.find((event) => event.id === id) ?? null;
  }

  const response = await supabaseFetch(
    `${EVENTS_TABLE}?select=id,name,date,description,image_path,sign_up_link,event_type,status&id=eq.${encodeURIComponent(id)}&limit=1`,
    {
      headers: supabaseHeaders(),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return null;
  }

  const rows = (await response.json()) as SupabaseEventRow[];
  return rows.length > 0 ? toEvent(rows[0]) : null;
}

export async function createEvent(payload: CreateEventInput): Promise<AACEvent> {
  ensureSupabaseConfig();

  const body = {
    name: payload.name,
    date: payload.date,
    description: payload.description,
    image_path: payload.imagePath,
    sign_up_link: payload.signUpLink ?? null,
    event_type: payload.type ?? null,
    status: normalizeStatus(payload.status),
  };

  const response = await supabaseFetch(EVENTS_TABLE, {
    method: "POST",
    headers: supabaseHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Failed to create event: ${details}`);
  }

  const rows = (await response.json()) as SupabaseEventRow[];
  if (!rows[0]) {
    throw new Error("Failed to create event");
  }

  return toEvent(rows[0]);
}

export async function updateEvent(
  id: string,
  payload: UpdateEventInput,
): Promise<AACEvent | null> {
  ensureSupabaseConfig();

  const body: Record<string, unknown> = {};

  if (payload.name !== undefined) body.name = payload.name;
  if (payload.date !== undefined) body.date = payload.date;
  if (payload.description !== undefined) body.description = payload.description;
  if (payload.imagePath !== undefined) body.image_path = payload.imagePath;
  if (payload.signUpLink !== undefined) body.sign_up_link = payload.signUpLink;
  if (payload.type !== undefined) body.event_type = payload.type;
  if (payload.status !== undefined) body.status = normalizeStatus(payload.status);

  if (Object.keys(body).length === 0) {
    return getEventById(id);
  }

  const response = await supabaseFetch(
    `${EVENTS_TABLE}?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: supabaseHeaders({ Prefer: "return=representation" }),
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Failed to update event: ${details}`);
  }

  const rows = (await response.json()) as SupabaseEventRow[];
  return rows.length > 0 ? toEvent(rows[0]) : null;
}

export async function deleteEvent(id: string): Promise<boolean> {
  ensureSupabaseConfig();

  const response = await supabaseFetch(
    `${EVENTS_TABLE}?id=eq.${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: supabaseHeaders({ Prefer: "return=representation" }),
    },
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Failed to delete event: ${details}`);
  }

  const rows = (await response.json()) as SupabaseEventRow[];
  return rows.length > 0;
}

export async function seedPastFallbackIfEmpty(): Promise<{
  seeded: number;
  totalPast: number;
}> {
  ensureSupabaseConfig();

  const existingPast = await listEvents("past");
  if (existingPast.length > 0) {
    return { seeded: 0, totalPast: existingPast.length };
  }

  if (SEEDED_PAST_EVENTS.length === 0) {
    return { seeded: 0, totalPast: 0 };
  }

  const payload = SEEDED_PAST_EVENTS.map((event) => ({
    id: event.id,
    name: event.name,
    date: event.date,
    description: event.description,
    image_path: event.imagePath,
    sign_up_link: event.signUpLink ?? null,
    event_type: event.type ?? null,
    status: "past",
  }));

  const response = await supabaseFetch(
    `${EVENTS_TABLE}?on_conflict=id`,
    {
      method: "POST",
      headers: supabaseHeaders({
        Prefer: "resolution=merge-duplicates,return=representation",
      }),
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Failed to seed past events: ${details}`);
  }

  const rows = (await response.json()) as SupabaseEventRow[];
  const totalPast = (await listEvents("past")).length;

  return {
    seeded: rows.length,
    totalPast,
  };
}
