import type { Event, Schema } from "./api";

export function logEventActivity(
  event: Pick<Event, "id" | "activity_logging">,
  action: Schema<"EventActivityWrite">["action"],
  attemptId?: string,
) {
  if (!event.activity_logging) return;
  // Best effort only: a telemetry failure must never block a reservation.
  void fetch(`/api/events/${event.id}/activity`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, attempt_id: attemptId }),
    keepalive: true,
  }).catch(() => {});
}
