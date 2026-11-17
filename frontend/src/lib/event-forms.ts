import type { Schema } from "./api";

export type EventForm = Schema<"EventFormView">;
export const responseLabels: Record<
  Schema<"EventFormSummary">["status"],
  string
> = {
  not_open: "Not open yet",
  awaiting: "Awaiting response",
  not_submitted: "Not submitted",
  no_response: "No Response",
  not_required: "Not required",
  responded: "Responded",
  responded_late: "Responded late",
  cancelled: "Cancelled",
};
export const phaseLabels: Record<EventForm["phase"], string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  open: "Open",
  closed: "Closed",
  late: "Late submissions open",
  archived: "Archived",
  unavailable: "Unavailable",
};
export const formURL = (form: EventForm, admin = false) =>
  `${admin ? "/admin" : ""}/events/${form.event_slug}/${form.event_id}/form/${form.number}`;
export const formAPI = (
  form: Pick<EventForm, "event_id" | "number">,
  admin = false,
) =>
  `/api/${admin ? "admin/" : ""}events/${form.event_id}/forms/${form.number}`;
export const formTime = (value: string) =>
  new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
    timeZoneName: "short",
  });
export const responseTone = (status: Schema<"EventFormSummary">["status"]) =>
  ["no_response", "awaiting", "not_open"].includes(status)
    ? "yellow"
    : status === "cancelled"
      ? "orange"
      : "green";
