import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { clock, dateLabel, useAPI } from "../lib/api";
import type { Event, Schema } from "../lib/api";
import { useIdentity } from "../lib/context";

export type Restriction = Schema<"RestrictionView">;
export const eventKindLabels: Record<string, string> = {
  regular: "Regular events",
  meeting: "Meetings",
  picnic: "Picnics",
  retreat: "Retreats",
};

export function restrictionScope(r: Restriction) {
  return [
    ...(r.all_events
      ? ["All events"]
      : r.event_kinds.map((k) => eventKindLabels[k] || k)),
    ...r.events.map((e) => e.name),
    ...(r.membership ? ["Membership signups"] : []),
  ].join(" · ");
}

export function matchesRestriction(
  r: Restriction,
  event: Pick<Event, "id" | "kind">,
) {
  return (
    r.all_events ||
    r.event_kinds.includes(event.kind) ||
    r.events.some((e) => e.id === event.id)
  );
}

export function useRestrictions() {
  const { session } = useIdentity();
  const cache = useQueryClient();
  const query = useAPI("Items_RestrictionView_", "/api/me/restrictions", {
    enabled: !!session?.member,
  });
  const expiry = query.data?.items
    .map((r) => r.expires_at)
    .filter((d): d is string => !!d)
    .sort()[0];
  useEffect(() => {
    if (!session?.member) return;
    const refresh = () =>
      void cache.invalidateQueries({ queryKey: ["Items_RestrictionView_"] });
    const delay = expiry
      ? Math.max(100, Date.parse(expiry) - Date.now() + 100)
      : undefined;
    const timer =
      delay === undefined
        ? undefined
        : window.setTimeout(refresh, Math.min(delay, 2_147_483_647));
    window.addEventListener("focus", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [cache, expiry, session?.member, query.dataUpdatedAt]);
  const items = query.data?.items || [];
  return {
    ...query,
    items,
    membershipRestricted: items.some((r) => r.membership),
  };
}

export function RestrictionNotice({ items }: { items: Restriction[] }) {
  if (!items.length) return null;
  return (
    <section
      className="notice restriction-notice"
      role="status"
      aria-label="Signup restrictions"
    >
      <strong>
        {items.length === 1 ? "Signup restriction" : "Signup restrictions"}
      </strong>
      {items.map((r) => (
        <div key={r.id} className="restriction-item">
          <p>
            <strong>{restrictionScope(r)}</strong>
          </p>
          <p>
            {r.expires_at
              ? `Until ${dateLabel(r.expires_at, { month: "short", day: "numeric", year: "numeric" })}, ${clock(r.expires_at)} Pacific.`
              : "In effect until lifted by an officer."}
          </p>
          {r.message && <p className="preserve-lines">{r.message}</p>}
        </div>
      ))}
      <p>
        You can still sign in and manage your account. For help,{" "}
        <a href="mailto:anteatereateradventureclub@gmail.com">
          contact AAC officers
        </a>
        .
      </p>
    </section>
  );
}
