import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { clock, dateLabel } from "../lib/api";
import type { Quarter } from "../lib/api";

export function useMembershipPause(quarter?: Quarter) {
  const cache = useQueryClient();
  const [tick, setTick] = useState(0);
  const start = quarter?.membership_pause_starts_at;
  const end = quarter?.membership_pause_ends_at;
  useEffect(() => {
    const refresh = () =>
      void cache.invalidateQueries({ queryKey: ["Page_QuarterPublic_"] });
    const now = Date.now();
    const next = [start, end]
      .filter((date): date is string => !!date)
      .map(Date.parse)
      .filter((date) => date > now)
      .sort((a, b) => a - b)[0];
    const timer =
      next === undefined
        ? undefined
        : window.setTimeout(
            () => {
              refresh();
              setTick((value) => value + 1);
            },
            Math.min(next - now + 100, 2_147_483_647),
          );
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [cache, start, end, quarter?.membership_signups_paused, tick]);
  return quarter?.state === "open" && !!quarter.membership_signups_paused;
}

export function MembershipPauseNotice({ quarter }: { quarter: Quarter }) {
  return (
    <div className="notice" role="status">
      <strong>Membership signups are temporarily paused</strong>
      <p>{quarter.membership_pause_message}</p>
      {quarter.membership_pause_ends_at && (
        <p>
          Signups reopen {dateLabel(quarter.membership_pause_ends_at)},{" "}
          {clock(quarter.membership_pause_ends_at)} Pacific time.
        </p>
      )}
    </div>
  );
}
