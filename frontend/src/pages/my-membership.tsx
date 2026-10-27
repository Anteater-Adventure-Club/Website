import { RestrictionNotice, useRestrictions } from "../components/restrictions";
import { Link } from "react-router";
import { Car, Check, Clock, Leaf, Tent, Vote, Wallet } from "lucide-react";
import { clock, dateLabel, money, pacificDate, useAPI } from "../lib/api";
import type { Quarter, Schema } from "../lib/api";
import { staticAssetURL } from "../lib/images";
import { quarterURL, useIdentity, useQuarter } from "../lib/context";
import {
  MembershipPauseNotice,
  useMembershipPause,
} from "../components/membership-pause";
import {
  Empty,
  Failure,
  Loading,
  PageHeading,
  Panel,
  Pill,
} from "../components/ui";

function MembershipBenefits() {
  const benefits = [
    [
      Tent,
      "Quarterly camping retreat",
      "Retreat attendance requires approved membership.",
    ],
    [
      Car,
      "Carpool priority",
      "Paid members receive priority for available carpool seats.",
    ],
    [
      Wallet,
      "Driver reimbursements",
      "Eligible drivers share the quarter’s budget for capped driving costs.",
    ],
    [Vote, "Voting", "Vote on club decisions."],
    [
      Leaf,
      "Club events and equipment",
      "Dues help pay for club events and camping gear.",
    ],
  ] as const;
  return (
    <>
      <ul className="personal-membership-benefits">
        {benefits.map(([Icon, title, copy]) => (
          <li key={title}>
            <span className="membership-benefit-icon">
              <Icon size={19} aria-hidden="true" />
            </span>
            <div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="membership-free-note">
        <strong>Weekly activities are free.</strong>
        <p>
          General members can attend regular events and meetings without paying
          dues.
        </p>
      </div>
    </>
  );
}

function MembershipRates() {
  return (
    <div className="membership-rates">
      <div>
        <strong>$25</strong>
        <p>UCI students / quarter</p>
      </div>
      <div>
        <strong>$30</strong>
        <p>Non-students / quarter</p>
      </div>
    </div>
  );
}

function membershipLabel(status: Schema<"MembershipView">) {
  if (status.status === "pending") return "Pending confirmation";
  if (status.retreat_membership_required && status.status !== "approved")
    return "Pending";
  if (status.status !== "approved") return "General member";
  if (status.source === "exception") return "Paid member · Officer exception";
  return "Paid member";
}

function MembershipRecord({
  status,
  quarter,
}: {
  status: Schema<"MembershipView">;
  quarter: Quarter;
}) {
  const { session } = useIdentity();
  const pending = status.status === "pending";
  const expired = quarter.ends_on < pacificDate();
  const methodName = (method: string) =>
    method === "cash"
      ? "Cash"
      : method === "zelle"
        ? "Zelle"
        : method === "venmo"
          ? "Venmo"
          : method;
  return (
    <>
      <dl className="membership-details">
        <div>
          <dt>Member</dt>
          <dd>{session?.member?.name}</dd>
        </div>
        <div>
          <dt>Quarter</dt>
          <dd>{quarter.name}</dd>
        </div>
        {pending ? (
          status.submitted_at && (
            <div>
              <dt>Submitted</dt>
              <dd>{dateLabel(status.submitted_at)}</dd>
            </div>
          )
        ) : (
          <div>
            <dt>{expired ? "Benefits ended" : "Benefits through"}</dt>
            <dd>
              {dateLabel(quarter.ends_on, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </dd>
          </div>
        )}
        {pending && (
          <>
            <div>
              <dt>Category</dt>
              <dd>
                {status.student ? "UCI student · $25" : "Non-student · $30"}
              </dd>
            </div>
            <div>
              <dt>Payment method</dt>
              <dd>{methodName(status.method)}</dd>
            </div>
          </>
        )}
      </dl>
      {status.receipts.map((receipt) => (
        <dl
          className="membership-details membership-receipt"
          key={receipt.id}
          aria-label="Recorded payment"
        >
          <div>
            <dt>Amount recorded</dt>
            <dd>{money(receipt.amount)}</dd>
          </div>
          <div>
            <dt>Payment date</dt>
            <dd>{dateLabel(receipt.paid_on)}</dd>
          </div>
          <div>
            <dt>Payment method</dt>
            <dd>{methodName(receipt.method)}</dd>
          </div>
        </dl>
      ))}
      <div className="notice">
        {pending
          ? "You don’t need to send another payment or submit again. An officer will review your submission."
          : status.source === "exception"
            ? "An officer approved your membership. No payment receipt is required."
            : status.source === "imported" && !status.receipts.length
              ? "Your membership record was imported. Payment details weren’t provided."
              : expired || quarter.state !== "open"
                ? "This membership is recorded for a past or closed quarter. Select the current quarter to view your current status."
                : "Your membership benefits are active for this quarter."}
      </div>
      <div className="actions">
        <Link className="button primary" to="/events">
          View events
        </Link>
        <Link
          className="button secondary"
          to={quarterURL("/my-aac/signups", quarter.id)}
        >
          My signups
        </Link>
      </div>
      <details className="membership-signup-information">
        <summary>Membership signup information</summary>
        <MembershipRates />
        <p>
          Choose your category, pay by Zelle, Venmo, or cash, and submit for
          officer approval. Membership applies to one quarter at a time.
        </p>
      </details>
    </>
  );
}

export function MyMembership() {
  const restrictions = useRestrictions();
  const { session } = useIdentity();
  const { quarter, loading } = useQuarter();
  const membershipPaused = useMembershipPause(quarter);
  const membership = useAPI(
    "MembershipView",
    `/api/me/memberships/${quarter?.id}`,
    { enabled: !!session?.member && !!quarter },
  );
  if (loading) return <Loading />;
  if (!quarter)
    return (
      <>
        <PageHeading
          title="Your membership"
          subtitle="Membership status, dues, and benefits."
        />
        <Empty
          title="No quarter available"
          action={
            <Link className="button primary" to="/events">
              View events
            </Link>
          }
        >
          Membership dues are closed until the next quarter is set up. Weekly
          activities are free.
        </Empty>
      </>
    );
  if (membership.isPending || restrictions.isPending) return <Loading />;
  if (restrictions.error)
    return <Failure error={restrictions.error} retry={restrictions.refetch} />;
  if (membership.error)
    return <Failure error={membership.error} retry={membership.refetch} />;
  const status = membership.data;
  const approved = status.status === "approved";
  const pending = status.status === "pending";
  const expired = quarter.ends_on < pacificDate();
  const closed = quarter.state !== "open" || expired;
  const date = dateLabel(quarter.ends_on, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const awaitingSignup =
    !approved &&
    !pending &&
    !restrictions.membershipRestricted &&
    status.retreat_membership_required;
  const Icon = approved ? Check : pending || awaitingSignup ? Clock : Leaf;
  return (
    <div
      className="personal-membership"
      data-membership-status={pending || awaitingSignup ? "pending" : undefined}
    >
      <PageHeading
        title="Your membership"
        subtitle="Membership status, dues, and benefits."
      >
        <Link className="text-link" to={quarterURL("/membership", quarter.id)}>
          About AAC membership ↗
        </Link>
      </PageHeading>
      <div className="personal-membership-layout">
        <section
          className="membership-pass"
          aria-label="Your membership status"
        >
          <div className="membership-pass-top">
            <div>
              <span className="membership-eyebrow">
                Anteater Adventure Club
              </span>
              <small>UC Irvine · {quarter.name}</small>
            </div>
            <img
              src={staticAssetURL("/logos/aac.svg")}
              alt=""
              width={54}
              height={54}
            />
          </div>
          <h2>
            {approved
              ? "Paid Membership"
              : pending || awaitingSignup
                ? "Pending membership"
                : "General member"}
          </h2>
          <p className="membership-pass-name">{session?.member?.name}</p>
          <p className="membership-pass-meta">
            {approved
              ? `${expired ? "Benefits ended" : "Benefits through"} ${date}`
              : pending
                ? "Waiting for officer confirmation"
                : awaitingSignup
                  ? "Membership signup needed"
                  : "Weekly activities are free"}
          </p>
          <div className="membership-pass-bottom">
            <div>
              <Pill tone={pending || awaitingSignup ? "yellow" : "green"}>
                {restrictions.membershipRestricted && !approved && !pending
                  ? "General member"
                  : membershipLabel(status)}
              </Pill>
              <p>
                {approved
                  ? status.source === "exception"
                    ? "No payment required"
                    : status.source === "imported"
                      ? "Paid membership on record"
                      : expired || closed
                        ? "Membership recorded for this quarter"
                        : "Paid membership benefits are active"
                  : pending
                    ? restrictions.membershipRestricted
                      ? "Submission on hold"
                      : "No further action needed"
                    : "Paid membership is not active"}
              </p>
            </div>
            <span className="membership-pass-stamp">
              <Icon size={30} aria-hidden="true" />
            </span>
          </div>
        </section>
        <div className="personal-membership-content">
          <RestrictionNotice
            items={restrictions.items.filter((r) => r.membership)}
          />
          <Panel>
            <span className="membership-eyebrow muted">
              {pending
                ? "Payment submitted"
                : approved ||
                    awaitingSignup ||
                    restrictions.membershipRestricted
                  ? "Your membership"
                  : "Membership dues"}
            </span>
            <h2>
              {approved || awaitingSignup || restrictions.membershipRestricted
                ? "Membership details"
                : pending
                  ? "Payment awaiting confirmation"
                  : closed
                    ? `${quarter.name} membership`
                    : `Pay dues for ${quarter.name}`}
            </h2>
            {!approved && restrictions.membershipRestricted ? (
              <p>
                {pending
                  ? "Your submission is on hold for officer review. New approvals are restricted until this restriction ends."
                  : "Membership signup is currently restricted. You can still view your membership history."}
              </p>
            ) : awaitingSignup ? (
              <>
                <dl className="membership-details">
                  <div>
                    <dt>Member</dt>
                    <dd>{session?.member?.name}</dd>
                  </div>
                  <div>
                    <dt>Quarter</dt>
                    <dd>{quarter.name}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>Pending</dd>
                  </div>
                </dl>
                <p className="muted">
                  Complete your membership signup within 24 hours of reserving
                  your retreat spot to keep it.
                </p>
                {membershipPaused && quarter.membership_pause_ends_at && (
                  <p className="muted">
                    Membership payments reopen{" "}
                    {dateLabel(quarter.membership_pause_ends_at)} at{" "}
                    {clock(quarter.membership_pause_ends_at)} Pacific.
                  </p>
                )}
                <div className="actions">
                  <Link
                    className="button primary membership-signup-link"
                    to={quarterURL("/membership", quarter.id)}
                  >
                    Go to Membership Signup
                  </Link>
                </div>
              </>
            ) : !approved && !pending ? (
              closed ? (
                <p className="muted">
                  Membership submissions for this quarter are closed.
                </p>
              ) : membershipPaused ? (
                <>
                  <MembershipPauseNotice quarter={quarter} />
                  <Link
                    className="button primary"
                    to={quarterURL("/membership", quarter.id)}
                  >
                    Go to Membership Signup
                  </Link>
                </>
              ) : (
                <>
                  <p className="muted">
                    Weekly activities are free. To get paid membership benefits,
                    pay the quarter’s dues and submit your payment details on
                    the membership signup page.
                  </p>
                  <Link
                    className="button primary"
                    to={quarterURL("/membership", quarter.id)}
                  >
                    Go to Membership Signup
                  </Link>
                </>
              )
            ) : (
              <>
                <p className="muted">
                  {pending
                    ? "An officer needs to review your payment. You can attend free weekly activities while you wait."
                    : expired || closed
                      ? `Your paid membership is recorded for ${quarter.name}.`
                      : `Your membership benefits are active for ${quarter.name}, through ${date}.`}
                </p>
                <MembershipRecord status={status} quarter={quarter} />
              </>
            )}
          </Panel>
          <Panel>
            <span className="membership-eyebrow muted">
              {approved
                ? expired || closed
                  ? "Recorded membership"
                  : "Your benefits"
                : "Paid membership"}
            </span>
            <h2>Membership benefits</h2>
            <MembershipBenefits />
          </Panel>
        </div>
      </div>
    </div>
  );
}
