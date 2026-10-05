import { useState } from "react";
import { Link } from "react-router";
import { Car, Check, Clock, Leaf, Tent, Vote, Wallet } from "lucide-react";
import { dateLabel, money, pacificDate, useAction, useAPI } from "../lib/api";
import type { Quarter, Schema } from "../lib/api";
import { staticAssetURL } from "../lib/images";
import { quarterURL, useIdentity, useQuarter } from "../lib/context";
import {
  Button,
  Empty,
  Failure,
  Field,
  Loading,
  Message,
  PageHeading,
  Panel,
  Pill,
} from "../components/ui";

function MembershipBenefits() {
  const benefits = [
    [
      Tent,
      "Quarterly camping retreat",
      "Retreat signups require approved membership.",
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

function PaymentInstructions({
  settings,
  method,
  student,
  quarter,
}: {
  settings: Schema<"SiteSettings">;
  method: Schema<"MembershipSubmit">["method"];
  student: boolean;
  quarter: Quarter;
}) {
  const amount = student ? "$25" : "$30";
  if (method === "cash") return <p>{settings.cash}</p>;
  if (method === "venmo")
    return settings.venmo ? (
      <>
        <p>
          Send {amount} to {settings.venmo} and include your name and{" "}
          {quarter.name}.
        </p>
        <a
          href={`https://venmo.com/${encodeURIComponent(settings.venmo.replace(/^@/, ""))}`}
          target="_blank"
          rel="noreferrer"
        >
          Open Venmo ↗
        </a>
      </>
    ) : (
      <p>Ask an officer for the club’s Venmo details before paying.</p>
    );
  return settings.zelle ? (
    <>
      <p>
        Send {amount} to {settings.zelle}. Include your name and {quarter.name}.
      </p>
      {settings.zelle_name?.trim() && (
        <strong className="zelle-recipient">
          {settings.zelle_name.trim()}
        </strong>
      )}
    </>
  ) : (
    <p>Ask an officer for the club’s Zelle details before paying.</p>
  );
}

function MembershipSignup({ quarter }: { quarter: Quarter }) {
  const { session } = useIdentity();
  const settings = useAPI("SiteSettings", "/api/site-settings");
  const action = useAction();
  const [student, setStudent] = useState(true);
  const [method, setMethod] =
    useState<Schema<"MembershipSubmit">["method"]>("zelle");
  const [paid, setPaid] = useState(false);
  const [phone, setPhone] = useState<string>();
  const contactPhone = phone ?? session?.member?.phone ?? "";
  return (
    <form
      className="membership-signup-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!paid || !contactPhone.trim() || !settings.data || action.isPending)
          return;
        await action
          .mutateAsync({
            url: `/api/me/memberships/${quarter.id}`,
            body: { student, method, phone: contactPhone.trim() },
          })
          .catch(() => {});
      }}
    >
      <Field
        label="Contact phone number"
        type="tel"
        autoComplete="tel"
        required
        maxLength={40}
        hint="So officers can contact you about your membership."
        value={contactPhone}
        onChange={(event) => setPhone(event.target.value)}
      />
      <fieldset>
        <legend>Choose your membership</legend>
        <div className="membership-category-options">
          {[true, false].map((isStudent) => (
            <label className="membership-category" key={String(isStudent)}>
              <input
                type="radio"
                name="category"
                checked={student === isStudent}
                onChange={() => {
                  setStudent(isStudent);
                  setPaid(false);
                }}
              />
              <strong>{isStudent ? "UCI student" : "Non-student"}</strong>
              <span className="membership-price">
                {isStudent ? "$25" : "$30"} <small>/ quarter</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Payment method</legend>
        <div className="membership-payment-options">
          {(["zelle", "venmo", "cash"] as const).map((value) => (
            <label key={value}>
              <input
                type="radio"
                name="method"
                checked={method === value}
                onChange={() => {
                  setMethod(value);
                  setPaid(false);
                }}
              />
              {value === "cash"
                ? "Cash at a meeting"
                : value === "venmo"
                  ? "Venmo"
                  : "Zelle"}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="membership-payment-notice">
        {settings.isPending ? (
          <Loading />
        ) : settings.error ? (
          <Failure error={settings.error} retry={settings.refetch} />
        ) : (
          <PaymentInstructions
            settings={settings.data}
            method={method}
            student={student}
            quarter={quarter}
          />
        )}
      </div>
      <label className="check-field">
        <input
          type="checkbox"
          required
          checked={paid}
          onChange={(event) => setPaid(event.target.checked)}
        />
        I have sent my payment or paid an officer.
      </label>
      <Message error={action.error} />
      <Button
        className="membership-submit"
        disabled={
          action.isPending ||
          !paid ||
          !contactPhone.trim() ||
          !settings.data ||
          !!settings.error
        }
      >
        {action.isPending ? "Submitting…" : "Submit payment details"}
      </Button>
      <p className="membership-form-note">
        Paid membership benefits apply after an officer confirms your payment.
      </p>
    </form>
  );
}

function membershipLabel(status: Schema<"MembershipView">) {
  if (status.status === "pending") return "Pending confirmation";
  if (status.status !== "approved") return "General member";
  if (status.source === "exception") return "Approved · Officer exception";
  if (status.source === "imported") return "Approved membership";
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
              ? "Your approved membership was imported. Payment details weren’t provided."
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
  const { session } = useIdentity();
  const { quarter, loading } = useQuarter();
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
  if (membership.isPending) return <Loading />;
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
  const Icon = approved ? Check : pending ? Clock : Leaf;
  return (
    <div className="personal-membership">
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
              ? "Approved membership"
              : pending
                ? "Payment submitted"
                : "General member"}
          </h2>
          <p className="membership-pass-name">{session?.member?.name}</p>
          <p className="membership-pass-meta">
            {approved
              ? `${expired ? "Benefits ended" : "Benefits through"} ${date}`
              : pending
                ? "Waiting for officer confirmation"
                : "Weekly activities are free"}
          </p>
          <div className="membership-pass-bottom">
            <div>
              <Pill tone={pending ? "yellow" : "green"}>
                {membershipLabel(status)}
              </Pill>
              <p>
                {approved
                  ? status.source === "exception"
                    ? "No payment required"
                    : status.source === "imported"
                      ? "Approved membership on record"
                      : expired || closed
                        ? "Membership recorded for this quarter"
                        : "Paid membership benefits are active"
                  : pending
                    ? "No further action needed"
                    : "Paid membership is not active"}
              </p>
            </div>
            <span className="membership-pass-stamp">
              <Icon size={30} aria-hidden="true" />
            </span>
          </div>
        </section>
        <div className="personal-membership-content">
          <Panel>
            <span className="membership-eyebrow muted">
              {pending
                ? "Payment submitted"
                : approved
                  ? "Your membership"
                  : "Membership dues"}
            </span>
            <h2>
              {approved
                ? "Membership approved"
                : pending
                  ? "Payment awaiting confirmation"
                  : closed
                    ? `${quarter.name} membership`
                    : `Pay dues for ${quarter.name}`}
            </h2>
            {!approved && !pending ? (
              closed ? (
                <p className="muted">
                  Membership submissions for this quarter are closed.
                </p>
              ) : (
                <>
                  <p className="muted">
                    Weekly activities are free. To get paid membership benefits,
                    pay the quarter’s dues and submit your payment details
                    below.
                  </p>
                  <MembershipSignup key={quarter.id} quarter={quarter} />
                </>
              )
            ) : (
              <>
                <p className="muted">
                  {pending
                    ? "An officer needs to review your payment. You can attend free weekly activities while you wait."
                    : expired || closed
                      ? `Your membership was approved for ${quarter.name}.`
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

export function Membership() {
  const { quarter } = useQuarter();
  const { session, loading } = useIdentity();
  const benefits = useAPI(
    "MembershipBenefitView",
    `/api/membership-benefits${quarter ? `?quarter_id=${quarter.id}` : ""}`,
  );
  const memberURL = quarterURL("/my-aac/membership", quarter?.id);
  return (
    <div className="page membership-page">
      <div className="center-heading">
        <h1>AAC membership</h1>
        <p>Quarterly dues and membership benefits.</p>
      </div>
      <div className="membership-layout">
        <div>
          <Panel>
            <h2>Membership benefits</h2>
            <MembershipBenefits />
          </Panel>
          <Panel className="section">
            <h3>Our live reimbursement budget</h3>
            {benefits.data?.quarter &&
            benefits.data.reimbursement_data_available ? (
              <p>
                {money(benefits.data.budget)} is available in{" "}
                {benefits.data.quarter.name}, currently covering{" "}
                {(Number(benefits.data.coverage) * 100).toFixed(0)}% of eligible
                capped driving costs.
              </p>
            ) : (
              <p>
                {benefits.data?.quarter
                  ? `Reimbursement data was not recorded for ${benefits.data.quarter.name}.`
                  : "The next quarter’s reimbursement budget will appear here when it’s ready."}
              </p>
            )}
          </Panel>
        </div>
        <Panel className="status-card">
          <h2>Quarterly membership</h2>
          <MembershipRates />
          <p>
            Membership is optional. Weekly activities and regular meetings are
            free.
          </p>
          {loading ? (
            <Loading />
          ) : (
            <Link
              className="button primary"
              to={
                session?.member
                  ? memberURL
                  : `/sign-in?return_to=${encodeURIComponent(memberURL)}`
              }
            >
              {session?.member
                ? "View your membership"
                : "Sign in to manage membership"}
            </Link>
          )}
        </Panel>
      </div>
    </div>
  );
}
