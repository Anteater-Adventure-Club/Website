import { dateLabel } from "../lib/api";
import { useIdentity } from "../lib/context";

export function GuestAccessNotice() {
  const { session } = useIdentity();
  const access = session?.officer_access;
  if (access?.kind !== "guest" || !access.expires_at) return null;
  return (
    <p className="guest-access-notice" role="status">
      Limited access · expires{" "}
      {dateLabel(access.expires_at, {
        dateStyle: "medium",
        timeStyle: "short",
      })}
    </p>
  );
}
