import type { Event } from "../lib/api";
import { capacityLabels, transportRoles } from "../lib/signup-capacity";
import { Field } from "./ui";

export function SignupCapacity({ event }: { event: Event }) {
  if (
    (["total", ...transportRoles] as const).every(
      (role) => event[`signup_cap_${role}`] == null,
    )
  )
    return null;
  return (
    <div className="signup-capacity" aria-label="Signup capacity">
      {(["total", ...transportRoles] as const).map((role) => {
        const cap = event[`signup_cap_${role}`];
        const count =
          role === "total"
            ? event.signup_count
            : event.signup_counts_by_role[role];
        return (
          <p key={role}>
            <strong>{capacityLabels[role]}:</strong> {count.toLocaleString()}
            {cap == null
              ? " · No limit"
              : ` / ${cap.toLocaleString()}${count >= cap ? " · Full" : ""}`}
          </p>
        );
      })}
    </div>
  );
}

export function CapacityOverride({
  enabled,
  reason,
  onEnabled,
  onReason,
}: {
  enabled: boolean;
  reason: string;
  onEnabled: (enabled: boolean) => void;
  onReason: (reason: string) => void;
}) {
  return (
    <fieldset>
      <legend>Officer capacity override</legend>
      <label className="check-field">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabled(e.target.checked)}
        />
        Allow this action to exceed signup limits
      </label>
      {enabled && (
        <Field
          label="Capacity override reason"
          value={reason}
          required
          maxLength={500}
          onChange={(e) => onReason(e.target.value)}
          hint="This reason and any exceeded limits are recorded in the audit log."
        />
      )}
    </fieldset>
  );
}
