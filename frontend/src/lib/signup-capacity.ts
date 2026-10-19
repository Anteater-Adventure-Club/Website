import type { Event, Schema } from "./api";

export const transportRoles = ["ride", "driver", "own"] as const;
export type TransportRole = (typeof transportRoles)[number];
export const capacityLabels = {
  total: "Total",
  ride: "Needs a ride",
  driver: "Driving others",
  own: "Own ride",
};

type CapacityEvent = Pick<
  Event,
  | "signup_cap_total"
  | "signup_cap_ride"
  | "signup_cap_driver"
  | "signup_cap_own"
  | "signup_count"
  | "signup_counts_by_role"
>;

export function remainingSignupSpots(
  event: CapacityEvent,
  role: TransportRole,
) {
  const cap = event[`signup_cap_${role}`];
  const remaining = Math.min(
    event.signup_cap_total == null
      ? Infinity
      : event.signup_cap_total - event.signup_count,
    cap == null ? Infinity : cap - event.signup_counts_by_role[role],
  );
  return Number.isFinite(remaining) ? Math.max(0, remaining) : null;
}

export function capacityBlocked(
  event: CapacityEvent,
  role: TransportRole,
  signup?: Pick<Schema<"SignupOwn">, "role" | "cancelled">,
) {
  const active = !!signup && !signup.cancelled;
  if (
    !active &&
    event.signup_cap_total != null &&
    event.signup_count >= event.signup_cap_total
  )
    return true;
  const cap = event[`signup_cap_${role}`];
  return (
    (!active || signup.role !== role) &&
    cap != null &&
    event.signup_counts_by_role[role] >= cap
  );
}
