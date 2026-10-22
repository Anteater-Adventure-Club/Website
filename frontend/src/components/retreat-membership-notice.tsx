import { Link } from "react-router";
import { clock, dateLabel, useAPI } from "../lib/api";
import { quarterURL, useQuarter } from "../lib/context";
import { useMembershipPause } from "./membership-pause";

export function RetreatMembershipNotice({
  quarterId,
  reserved = false,
  submitted: submittedProp,
}: {
  quarterId: number;
  reserved?: boolean;
  submitted?: boolean;
}) {
  const { quarters } = useQuarter();
  const membership = useAPI(
    "MembershipView",
    `/api/me/memberships/${quarterId}`,
    { enabled: reserved && submittedProp === undefined },
  );
  const submitted = submittedProp ?? membership.data?.status === "pending";
  const quarter = quarters.find((q) => q.id === quarterId);
  const paused = useMembershipPause(quarter);
  return (
    <div
      className={`notice retreat-membership-notice${submitted ? " info" : ""}`}
      role="note"
    >
      <strong>
        {submitted
          ? "Dues awaiting officer approval"
          : reserved
            ? "Membership needed to keep your spot"
            : "Reserve first. Become a member after."}
      </strong>
      <p>
        {submitted
          ? "Your payment confirmation has been submitted. An officer will review your membership; you do not need to submit it again."
          : reserved
            ? "Become a paid member within 24 hours of signing up to keep your spot. Officers will review unpaid reservations."
            : "Become a paid member within 24 hours of reserving your spot to keep it."}
      </p>
      {reserved &&
        !submitted &&
        (paused && quarter?.membership_pause_ends_at ? (
          <p>
            Membership payments reopen{" "}
            {dateLabel(quarter.membership_pause_ends_at)} at{" "}
            {clock(quarter.membership_pause_ends_at)} Pacific.
          </p>
        ) : (
          <Link to={quarterURL("/my-aac/membership", quarterId)}>
            Complete your membership →
          </Link>
        ))}
    </div>
  );
}
