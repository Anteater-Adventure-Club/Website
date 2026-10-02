import { useState } from "react";
import { Link } from "react-router";
import { dateLabel, money, useAction, useAPI } from "../lib/api";
import { useIdentity, useQuarter } from "../lib/context";
import {
  Button,
  Failure,
  Loading,
  Message,
  Panel,
  Pill,
} from "../components/ui";

export function Membership() {
  const { quarter, loading } = useQuarter();
  const { session, loading: identityLoading } = useIdentity();
  const benefits = useAPI(
    "MembershipBenefitView",
    `/api/membership-benefits${quarter ? `?quarter_id=${quarter.id}` : ""}`,
  );
  const membership = useAPI(
    "MembershipView",
    `/api/me/memberships/${quarter?.id}`,
    { enabled: !!session?.member && !!quarter },
  );
  const settings = useAPI("SiteSettings", "/api/site-settings");
  const action = useAction();
  const [student, setStudent] = useState(true);
  const [method, setMethod] = useState<"cash" | "venmo" | "zelle">("cash");
  const [paid, setPaid] = useState(false);
  const status = membership.data;
  const list = [
    [
      "Access to the quarterly camping retreat!",
      "Get out of town and explore somewhere new with the club. Retreat signups require approved membership.",
    ],
    [
      "Priority carpool assignments",
      "Paid members receive ride priority. A ride is guaranteed when offered passenger seats cover paid riders; offers can change.",
    ],
    [
      "Access to ride reimbursements",
      "Help the club get there. Eligible drivers share the quarterly reimbursement budget.",
    ],
    [
      "Voting access on club decisions",
      "Take part in shaping the community and our next adventures.",
    ],
    [
      "Help contribute to club events & camping gear",
      "Your membership supports the activities and shared resources that bring us together.",
    ],
  ];
  return (
    <div className="page membership-page">
      <div className="center-heading">
        <h1>AAC Membership</h1>
        <p>A little support goes a long way.</p>
      </div>
      <div className="membership-layout">
        <div>
          <div className="membership-top">
            <Panel>
              <h3>Weekly activities are completely free!</h3>
              <p className="muted">
                Membership is optional. General members are welcome at our
                regular events and meetings.
              </p>
            </Panel>
            <div className="price-block">
              <strong>$25</strong>
              <span>per quarter</span>
              <small>UCI students · $30 non-students</small>
            </div>
          </div>
          <h2 className="section">Why pay for membership?</h2>
          <ol className="benefit-list">
            {list.map(([title, copy], i) => (
              <li key={title}>
                <span className="benefit-number">{i + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </div>
              </li>
            ))}
          </ol>
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
            ) : benefits.data?.quarter ? (
              <p>
                Reimbursement data was not recorded for{" "}
                {benefits.data.quarter.name}.
              </p>
            ) : (
              <p>
                The next quarter’s reimbursement budget will appear here when
                it’s ready.
              </p>
            )}
          </Panel>
        </div>
        <aside>
          <Panel className="status-card">
            {loading || identityLoading ? (
              <Loading />
            ) : !session?.member ? (
              <>
                <h2>Come along!</h2>
                <p>
                  Sign in with your UCI Google account to join events and manage
                  your membership.
                </p>
                <Link
                  className="button primary heading-button"
                  to="/sign-in?return_to=%2Fmembership"
                >
                  Sign in to join
                </Link>
              </>
            ) : !quarter ? (
              <>
                <h2>A new adventure is coming</h2>
                <p>
                  Dues will open when the club’s next quarter is ready. Weekly
                  activities are free.
                </p>
                <Link className="button primary" to="/events">
                  Explore Events
                </Link>
              </>
            ) : membership.isPending ? (
              <Loading />
            ) : membership.error ? (
              <Failure error={membership.error} retry={membership.refetch} />
            ) : status?.status === "approved" ? (
              <>
                <Pill tone="solid">
                  Paid Member
                  {status.source === "exception" ? " · Exception" : ""}
                </Pill>
                <h2>You’re part of the adventure!</h2>
                <p>
                  You have paid membership benefits for {quarter.name}, through{" "}
                  {dateLabel(quarter.ends_on, {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                  .
                </p>
                {status.source === "exception" && (
                  <p className="muted">
                    Your membership was approved through an officer exception.
                    No payment receipt is required.
                  </p>
                )}
                {status.source === "imported" && (
                  <p className="muted">
                    Membership is approved; your payment history wasn’t
                    provided.
                  </p>
                )}
                <Link className="button primary heading-button" to="/events">
                  Explore Events!
                </Link>
              </>
            ) : status?.status === "pending" ? (
              <>
                <Pill tone="yellow">Pending confirmation</Pill>
                <h2>You’re all set for now!</h2>
                <p>
                  Your {status.student ? "$25" : "$30"} membership is waiting
                  for an officer to confirm your payment. You can sign up for
                  regular events as a general member meanwhile.
                </p>
                <dl>
                  <div>
                    <dt>Category</dt>
                    <dd>
                      {status.student ? "Student · $25" : "Non-student · $30"}
                    </dd>
                  </div>
                  <div>
                    <dt>Paid by</dt>
                    <dd>{status.method}</dd>
                  </div>
                  {status.submitted_at && (
                    <div>
                      <dt>Submitted</dt>
                      <dd>{dateLabel(status.submitted_at)}</dd>
                    </div>
                  )}
                </dl>
                <Link className="button primary heading-button" to="/events">
                  Explore Events!
                </Link>
              </>
            ) : (
              <>
                <h2>Join for {quarter.name}!</h2>
                {quarter.state !== "open" ? (
                  <p>Membership submissions for this quarter are closed.</p>
                ) : (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await action
                        .mutateAsync({
                          url: `/api/me/memberships/${quarter.id}`,
                          body: { student, method },
                        })
                        .catch(() => {});
                    }}
                  >
                    <fieldset>
                      <legend>Membership</legend>
                      <div className="segmented">
                        <button
                          type="button"
                          aria-pressed={student}
                          onClick={() => setStudent(true)}
                        >
                          Student · $25
                        </button>
                        <button
                          type="button"
                          aria-pressed={!student}
                          onClick={() => setStudent(false)}
                        >
                          Non-student · $30
                        </button>
                      </div>
                    </fieldset>
                    <fieldset>
                      <legend>Paid by</legend>
                      <div className="stack">
                        {(["cash", "venmo", "zelle"] as const).map((value) => (
                          <label className="check-field" key={value}>
                            <input
                              type="radio"
                              checked={method === value}
                              onChange={() => {
                                setMethod(value);
                                setPaid(false);
                              }}
                              name="method"
                            />
                            {value === "cash"
                              ? "Cash at a meeting"
                              : value === "venmo"
                                ? settings.data?.venmo
                                  ? `Venmo · ${settings.data.venmo}`
                                  : "Venmo"
                                : "Zelle"}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <div className="notice">
                      {method === "cash" ? (
                        settings.data?.cash
                      ) : method === "venmo" ? (
                        settings.data?.venmo ? (
                          <>
                            <p>
                              Send {student ? "$25" : "$30"} to{" "}
                              {settings.data.venmo} and include your name and{" "}
                              {quarter.name}.
                            </p>
                            <a
                              href={`https://venmo.com/${encodeURIComponent(settings.data.venmo.replace(/^@/, ""))}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open Venmo ↗
                            </a>
                          </>
                        ) : (
                          "Ask an officer for the club’s Venmo details before paying."
                        )
                      ) : settings.data?.zelle ? (
                        <>
                          Send {student ? "$25" : "$30"} to{" "}
                          {settings.data.zelle}. Include your name and{" "}
                          {quarter.name}.
                        </>
                      ) : (
                        "Ask an officer for the club’s Zelle details before paying."
                      )}
                    </div>
                    {!session.profile_complete && (
                      <Message>
                        <Link to="/my-aac/profile">
                          Add your contact phone number
                        </Link>{" "}
                        before submitting dues.
                      </Message>
                    )}
                    <label className="check-field">
                      <input
                        type="checkbox"
                        required
                        checked={paid}
                        onChange={(e) => setPaid(e.target.checked)}
                      />
                      I’ve sent my payment or paid an officer.
                    </label>
                    <Message error={action.error} />
                    <Button
                      className="heading-button"
                      disabled={
                        action.isPending || !paid || !session.profile_complete
                      }
                    >
                      {action.isPending
                        ? "Submitting…"
                        : `I paid ${student ? "$25" : "$30"} · Submit for approval`}
                    </Button>
                    <small className="muted">
                      An officer confirms payments. Pending members keep general
                      membership benefits until approved.
                    </small>
                  </form>
                )}
              </>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}
