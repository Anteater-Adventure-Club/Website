import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { components } from "./api-schema";

export type Schema<K extends keyof components["schemas"]> =
  components["schemas"][K];
export type Event = Schema<"EventPublic">;
export type AdminEvent = Schema<"EventPrivate">;
export type Signup = Schema<"SignupOwn">;
export type Person = Schema<"MemberPrivate">;
export type Quarter = Schema<"QuarterPublic">;

export function attendanceLabel(signup: Pick<Signup, "attendance_status">) {
  return {
    registered: "Signed Up",
    checked_in: "Checked In",
    attended: "Attended",
    missed: "Missed",
    cancelled: "Cancelled",
    unknown: "Attendance not recorded",
  }[signup.attendance_status];
}

export function transportLabel(
  signup: Pick<Signup, "role" | "seats" | "vehicle">,
) {
  if (signup.role === "ride") return "Needs a ride";
  if (signup.role === "own") return "Has own ride";
  if (signup.role === "unknown") return "Transportation not recorded";
  const seats =
    signup.seats === null
      ? "Passenger seats not recorded"
      : `${signup.seats} passenger seats`;
  const car = signup.vehicle
    ? `${signup.vehicle.make} ${signup.vehicle.model}`
    : "Car details not recorded";
  return `Driving · ${seats} · ${car}`;
}

export function dateRange(
  start: string,
  end: string,
  options?: Intl.DateTimeFormatOptions,
) {
  const first = dateLabel(start, options);
  return pacificDate(new Date(start)) === pacificDate(new Date(end))
    ? first
    : `${first} – ${dateLabel(end, options)}`;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function request<T>(
  url: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const form = body instanceof FormData;
  const response = await fetch(url, {
    method,
    credentials: "same-origin",
    signal,
    headers:
      body !== undefined && !form ? { "Content-Type": "application/json" } : {},
    body: body === undefined ? undefined : form ? body : JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const detail = data.detail;
    const message = Array.isArray(detail)
      ? detail
          .map(
            (d: { loc?: string[]; msg: string }) =>
              `${d.loc?.slice(1).join(" ") || "Form"}: ${d.msg}`,
          )
          .join(". ")
      : typeof detail === "string"
        ? detail
        : detail?.message || "Something went wrong. Please try again.";
    throw new ApiError(
      response.status,
      detail?.code || "request_failed",
      message,
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export function useAPI<K extends keyof components["schemas"]>(
  schema: K,
  url: string,
  options?: {
    enabled?: boolean;
    poll?: boolean | ((data: Schema<K> | undefined) => boolean);
  },
) {
  const polling = (data: Schema<K> | undefined) =>
    typeof options?.poll === "function" ? options.poll(data) : !!options?.poll;
  return useQuery<Schema<K>, ApiError>({
    queryKey: [schema, url],
    queryFn: ({ signal }) => request(url, "GET", undefined, signal),
    enabled: options?.enabled ?? true,
    staleTime: (query) => (polling(query.state.data) ? 0 : 20_000),
    refetchInterval: (query) => (polling(query.state.data) ? 2000 : false),
    refetchIntervalInBackground: false,
    retry: (count, error) => error.status >= 500 && count < 1,
  });
}

export function useAction<T = unknown>() {
  const cache = useQueryClient();
  return useMutation<
    T,
    ApiError,
    { url: string; method?: string; body?: unknown }
  >({
    mutationFn: ({ url, method = "POST", body }) =>
      request<T>(url, method, body),
    onSuccess: () => cache.invalidateQueries(),
    onError: (error) => {
      if (error.status === 409) void cache.invalidateQueries();
    },
  });
}

export function eventURL(event: Pick<Event, "id" | "slug">, admin = false) {
  return `${admin ? "/admin" : ""}/events/${event.slug}/${event.id}`;
}
export function money(value?: string | number | null) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value || 0));
}
export function dateLabel(
  value: string,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    weekday: "short",
  },
) {
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: "America/Los_Angeles",
  }).format(new Date(value.length === 10 ? `${value}T12:00:00-08:00` : value));
}
export function clock(value?: string | null) {
  return value
    ? dateLabel(value, { hour: "numeric", minute: "2-digit" })
    : "To be announced";
}
export function departureTime(
  event: Pick<Event, "departure_at" | "starts_at">,
) {
  return event.departure_at || event.starts_at;
}
export function pacificDate(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}
export function photoURL(
  id?: string | null,
  privateImage = false,
  variant = "medium",
) {
  return id
    ? privateImage
      ? `/api/admin/media/${id}?variant=${variant}`
      : `/media/${id}/${variant}`
    : "/images/about_tide_pools.webp";
}

export function pacificInput(value?: string | null) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (key: string) => parts.find((p) => p.type === key)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
export function fromPacific(value: string): string | null {
  if (!value) return null;
  const [year, month, day, hour, minute] = value.split(/[-T:]/).map(Number);
  const local = Date.UTC(year, month - 1, day, hour, minute);
  const candidates = [7, 8]
    .map((offset) => new Date(local + offset * 3600000).toISOString())
    .filter((candidate) => pacificInput(candidate) === value);
  if (candidates.length !== 1)
    throw new Error(
      candidates.length
        ? "This Pacific time is ambiguous during daylight saving. Choose another time."
        : "This Pacific time does not exist during daylight saving. Choose another time.",
    );
  return candidates[0];
}
