import { Link } from "react-router";
import { useIdentity } from "../lib/context";
import { approvalLabel } from "../lib/approval";
import { Panel, Pill } from "./ui";

export function ApplicationNotice() {
  const { session } = useIdentity();
  const status = session?.member?.approval_status || "required";
  return (
    <Panel className="application-notice">
      {status === "denied" && (
        <Pill tone="orange">{approvalLabel(status)}</Pill>
      )}
      <h2>
        {status === "required"
          ? "Let’s get to know you"
          : status === "pending"
            ? "Your application is being reviewed"
            : "Your application was not approved"}
      </h2>
      <p>
        {status === "required"
          ? "New members without a UCI email need officer approval before joining club activities. Tell us a little about yourself to get started."
          : status === "pending"
            ? "An officer will review your answers. You can browse events while you wait; signups and membership become available after approval."
            : "You can still browse public pages. This decision is final, and another application cannot be submitted."}
      </p>
      <Link className="button primary" to="/my-aac/application">
        {status === "required" ? "Start application" : "View application"}
      </Link>
    </Panel>
  );
}
