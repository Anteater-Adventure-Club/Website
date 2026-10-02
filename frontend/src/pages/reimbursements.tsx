import { useState } from "react";
import { Link } from "react-router";
import { useForm } from "react-hook-form";
import { Check, LockKeyhole, Plus } from "lucide-react";
import { dateLabel, money, pacificDate, useAction, useAPI } from "../lib/api";
import type { Schema } from "../lib/api";
import { useQuarter } from "../lib/context";
import {
  Button,
  Dialog,
  Empty,
  Failure,
  Field,
  Loading,
  Message,
  PageHeading,
  Panel,
  Pill,
} from "../components/ui";
import { PersonDialog, SetupQuarter } from "../components/officer-forms";

type Driver = Schema<"DriverRow">;
export function Reimbursements() {
  const { quarter } = useQuarter();
  const query = useAPI(
    "QuarterReport",
    `/api/admin/quarters/${quarter?.id}/reimbursements`,
    { enabled: !!quarter },
  );
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [register, setRegister] = useState(false);
  const [eligibility, setEligibility] = useState<Driver | null>(null);
  const [details, setDetails] = useState<Driver | null>(null);
  const [payment, setPayment] = useState<Driver | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const action = useAction();
  if (!quarter)
    return (
      <>
        <PageHeading title="Reimbursements" />
        <SetupQuarter />
      </>
    );
  if (query.isPending) return <Loading />;
  if (query.error) return <Failure error={query.error} retry={query.refetch} />;
  const data = query.data;
  const frozen = data.state !== "open";
  const activeStep = frozen ? 5 : step;
  const drivers = data.drivers.filter(
    (d) =>
      `${d.name} ${d.email || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === "all" ||
        (filter === "eligible" && d.eligible) ||
        (filter === "ineligible" && !d.eligible) ||
        (filter === "pending" && !d.paid_on && Number(d.allocated) > 0) ||
        (filter === "paid" && d.paid_on)),
  );
  const pending = data.drivers.filter(
    (d) => Number(d.allocated) > 0 && !d.paid_on,
  );
  return (
    <>
      <PageHeading
        title="Reimbursements"
        subtitle={`${quarter.name} · ${frozen ? "Frozen allocations and payment history." : "Review drivers and trip costs before closing out the quarter."}`}
      >
        <Pill tone={frozen ? "gray" : "green"}>{data.state}</Pill>
        {!frozen && (
          <Button variant="secondary" onClick={() => setRegister(true)}>
            <Plus size={16} />
            Register Driver
          </Button>
        )}
      </PageHeading>
      <nav className="closeout-steps" aria-label="Quarter close-out steps">
        {["Budget", "Drivers", "Events", "Review", "Payments"].map(
          (label, i) => (
            <button
              key={label}
              aria-current={activeStep === i + 1 ? "step" : undefined}
              disabled={frozen && i !== 4}
              className={activeStep === i + 1 ? "selected" : ""}
              onClick={() => setStep(i + 1)}
            >
              <span>{frozen && i < 4 ? <Check size={16} /> : i + 1}</span>
              {label}
            </button>
          ),
        )}
      </nav>
      <div className="stat-grid section">
        {[
          ["Budget", money(data.budget)],
          [
            "Driver cap",
            Number(data.driver_cap) ? money(data.driver_cap) : "No cap",
          ],
          ["Coverage", `${(Number(data.coverage) * 100).toFixed(1)}%`],
          [
            frozen ? "Pending payments" : "Estimated total",
            money(data.totals[frozen ? "pending" : "allocated"]),
          ],
        ].map(([label, value]) => (
          <Panel key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </Panel>
        ))}
      </div>
      <section className="section">
        {activeStep === 1 ? (
          <Panel>
            <h2>1. Set the quarter budget</h2>
            <p>
              Reimbursements use final round-trip mileage × the event rate.
              Eligible totals are capped per driver, then prorated to fit the
              budget.
            </p>
            <Budget quarterId={quarter.id} />
            <Button className="section" onClick={() => setStep(2)}>
              Next: Drivers
            </Button>
          </Panel>
        ) : activeStep === 3 ? (
          <>
            <PageHeading
              title="3. Review event mileage"
              subtitle="Check mileage, gas price, and driver trips for every event."
            />
            <div className="stack">
              {data.events.map((e) => (
                <Panel className="record-card" key={e.id}>
                  <div>
                    <h3>{e.name}</h3>
                    <p>
                      {dateLabel(e.starts_at)} · {e.miles} miles · $
                      {Number(e.rate).toFixed(6)}/mi
                    </p>
                    <small>
                      {e.trip_count} trips · {money(e.cost)} nominal
                    </small>
                  </div>
                  <Link
                    className="button secondary"
                    to={`/admin/events/event/${e.id}?tab=trips`}
                  >
                    Trips & Mileage
                  </Link>
                </Panel>
              ))}
              {!data.events.length && (
                <Empty title="No events yet">
                  Create events with the unified event editor.
                </Empty>
              )}
            </div>
            <Button className="section" onClick={() => setStep(4)}>
              Next: Review Totals
            </Button>
          </>
        ) : activeStep === 4 ? (
          <Panel>
            <h2>4. Review & finalize</h2>
            <div className="calculation-list">
              {[
                ["Nominal trip costs", data.totals.nominal],
                ["Eligible driver costs", data.totals.eligible_cost],
                ["After per-driver caps", data.totals.capped],
                ["Allocated within budget", data.totals.allocated],
              ].map(([label, value]) => (
                <p key={label}>
                  <span>{label}</span>
                  <strong>{money(value)}</strong>
                </p>
              ))}
            </div>
            <p className="muted">
              The server allocates exact cents consistently. Finalizing freezes
              the driver eligibility, trip details, and allocation amounts.
              Positive allocations must be paid before archiving.
            </p>
            <Button
              onClick={() => {
                action.reset();
                setConfirm("finalize");
              }}
            >
              <LockKeyhole size={16} />
              Finalize Quarter
            </Button>
          </Panel>
        ) : (
          <>
            <div className="section-heading">
              <h2>
                {activeStep === 5
                  ? `${data.state === "archived" ? "Archived quarter" : "5. Record payments"}`
                  : "2. Review driver eligibility"}
              </h2>
              {activeStep === 5 && data.state === "finalized" && (
                <Button
                  variant="secondary"
                  disabled={!!pending.length}
                  onClick={() => {
                    action.reset();
                    setConfirm("archive");
                  }}
                >
                  Archive Quarter
                </Button>
              )}
            </div>
            {activeStep === 5 && (
              <Message>
                {data.state === "archived"
                  ? "This quarter is archived and read-only."
                  : frozen
                    ? `${money(data.totals.paid)} paid · ${pending.length} payments remaining. Zero-dollar allocations need no payment.`
                    : "Finalize the quarter in Review to record payments."}
              </Message>
            )}
            <div className="filters">
              <input
                aria-label="Search reimbursement drivers"
                placeholder="Search driver name or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                aria-label="Driver filter"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">All drivers</option>
                <option value="eligible">Eligible</option>
                <option value="ineligible">Ineligible</option>
                {frozen && (
                  <>
                    <option value="pending">Payment pending</option>
                    <option value="paid">Paid</option>
                  </>
                )}
              </select>
            </div>
            {drivers.length ? (
              <div className="table-wrapper">
                <table className="record-table">
                  <thead>
                    <tr>
                      <th>Driver</th>
                      <th>Eligibility</th>
                      <th>Nominal / capped</th>
                      <th>{frozen ? "Frozen payout" : "Estimate"}</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drivers.map((d) => (
                      <tr key={d.member_id}>
                        <td data-label="Driver">
                          <strong>{d.name}</strong>
                          <small>{d.email}</small>
                          {frozen && (
                            <small>
                              {d.payout_method || "No payment method"} ·{" "}
                              {d.payout_destination ||
                                "Ask driver for destination"}
                              {d.payout_phone_suffix &&
                                ` · ending ${d.payout_phone_suffix}`}
                            </small>
                          )}
                        </td>
                        <td data-label="Eligibility">
                          <Pill tone={d.eligible ? "green" : "orange"}>
                            {d.eligible ? "Eligible" : "Ineligible"}
                          </Pill>
                          <small>
                            {d.eligible_override !== null
                              ? "Officer override"
                              : d.membership_approved
                                ? "Approved membership"
                                : "General member"}
                            {d.eligibility_reason &&
                              ` · ${d.eligibility_reason}`}
                          </small>
                        </td>
                        <td data-label="Costs">
                          {money(d.nominal)} / {money(d.capped)}
                          <small>{d.trips.length} trips</small>
                        </td>
                        <td data-label={frozen ? "Frozen payout" : "Estimate"}>
                          <strong>{money(d.allocated)}</strong>
                          {frozen && (
                            <small>
                              {d.paid_on
                                ? `Paid ${dateLabel(d.paid_on)} · ${d.reference}`
                                : Number(d.allocated)
                                  ? "Payment pending"
                                  : "No payment required"}
                            </small>
                          )}
                        </td>
                        <td data-label="Actions">
                          <div className="actions">
                            <Button
                              variant="quiet"
                              onClick={() => setDetails(d)}
                            >
                              Details
                            </Button>
                            {!frozen && (
                              <Button
                                variant="secondary"
                                onClick={() => setEligibility(d)}
                              >
                                Eligibility
                              </Button>
                            )}
                            {data.state === "finalized" &&
                              !d.paid_on &&
                              Number(d.allocated) > 0 && (
                                <Button onClick={() => setPayment(d)}>
                                  Mark Paid
                                </Button>
                              )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title={
                  data.drivers.length
                    ? "No drivers match"
                    : "No driving trips this quarter"
                }
                action={
                  !frozen && (
                    <Button onClick={() => setRegister(true)}>
                      Register a Driver
                    </Button>
                  )
                }
              >
                {data.drivers.length
                  ? "Try another filter."
                  : "Drivers and their trips will appear here as events take place."}
              </Empty>
            )}
            {!frozen && activeStep === 2 && (
              <Button className="section" onClick={() => setStep(3)}>
                Next: Events
              </Button>
            )}
          </>
        )}
      </section>
      <Message error={action.error} />
      {register && (
        <PersonDialog
          title="Register driver"
          onClose={() => setRegister(false)}
          onSelect={(person) => {
            void action
              .mutateAsync({
                url: `/api/admin/quarters/${quarter.id}/drivers`,
                body: { member_id: person.id },
              })
              .catch(() => {});
          }}
        />
      )}
      {eligibility && (
        <Eligibility
          driver={eligibility}
          quarterId={quarter.id}
          onClose={() => setEligibility(null)}
        />
      )}
      {payment && <Payment driver={payment} onClose={() => setPayment(null)} />}
      {details && (
        <Dialog title={details.name} onClose={() => setDetails(null)} wide>
          <div className="details-grid">
            <p>
              <small>Payout destination · private</small>
              {details.payout_method || "Not provided"} ·{" "}
              {details.payout_destination || "Not provided"}
            </p>
            <p>
              <small>{frozen ? "Frozen payout" : "Estimate"}</small>
              {money(details.allocated)}
            </p>
          </div>
          <div className="stack">
            {details.trips.map((t) => (
              <Link
                className="history-row"
                key={t.id}
                to={`/admin/events/event/${t.event_id}?tab=trips`}
                onClick={() => setDetails(null)}
              >
                <strong>{t.event_name}</strong>
                <span>
                  {dateLabel(t.starts_at)} · {money(t.cost)}
                  {t.cost_override !== null && " · Override"}
                </span>
                <small>{t.notes}</small>
              </Link>
            ))}
          </div>
          {!details.trips.length && <p>No trips recorded.</p>}
        </Dialog>
      )}
      {confirm && (
        <Dialog
          title={
            confirm === "finalize"
              ? "Finalize this quarter?"
              : "Archive this quarter?"
          }
          onClose={() => setConfirm(null)}
        >
          <p>
            {confirm === "finalize"
              ? `${data.drivers.length} driver allocations totaling ${money(data.totals.allocated)} will be frozen. Budget, eligibility, dues, and trips will become read-only for this quarter.`
              : "All positive payouts have been recorded. Archiving preserves the quarter and payment history as read-only."}
          </p>
          <Message error={action.error} />
          <div className="form-actions">
            <Button variant="quiet" onClick={() => setConfirm(null)}>
              Keep Reviewing
            </Button>
            <Button
              disabled={action.isPending}
              onClick={() => {
                void action
                  .mutateAsync({
                    url: `/api/admin/quarters/${quarter.id}/${confirm}`,
                  })
                  .then(() => setConfirm(null))
                  .catch(() => {});
              }}
            >
              {confirm === "finalize"
                ? "Freeze Allocations"
                : "Archive Quarter"}
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
function Budget({ quarterId }: { quarterId: number }) {
  const query = useAPI("Page_QuarterPrivate_", "/api/admin/quarters");
  const q = query.data?.items.find((q) => q.id === quarterId);
  if (!q) return <Loading />;
  return <BudgetForm key={q.id} quarter={q} />;
}
function BudgetForm({ quarter }: { quarter: Schema<"QuarterPrivate"> }) {
  const form = useForm({
    defaultValues: {
      budget: quarter.budget,
      driver_cap: quarter.driver_cap,
      mpg: quarter.mpg,
    },
  });
  const action = useAction();
  const [saved, setSaved] = useState(false);
  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        setSaved(false);
        await action
          .mutateAsync({
            url: `/api/admin/quarters/${quarter.id}`,
            method: "PUT",
            body: {
              ...values,
              name: quarter.name,
              starts_on: quarter.starts_on,
              ends_on: quarter.ends_on,
              expected_revision: quarter.revision,
            },
          })
          .then(() => setSaved(true))
          .catch(() => {});
      })}
    >
      <div className="form-grid">
        <Field
          label="Ride budget ($)"
          required
          type="number"
          min={0}
          step=".01"
          {...form.register("budget")}
        />
        <Field
          label="Per-driver cap ($)"
          required
          type="number"
          min={0}
          step=".01"
          {...form.register("driver_cap")}
          hint="0 means no cap"
        />
        <Field
          label="Standard MPG"
          required
          type="number"
          min={1}
          max={200}
          step=".01"
          {...form.register("mpg")}
        />
      </div>
      <Message error={action.error} />
      {saved && <Message>Financial settings saved.</Message>}
      <Button variant="secondary" disabled={action.isPending}>
        Save Budget
      </Button>
    </form>
  );
}
function Eligibility({
  driver,
  quarterId,
  onClose,
}: {
  driver: Driver;
  quarterId: number;
  onClose: () => void;
}) {
  const [value, setValue] = useState(
    driver.eligible_override === null
      ? "membership"
      : driver.eligible_override
        ? "eligible"
        : "ineligible",
  );
  const [reason, setReason] = useState(driver.eligibility_reason);
  const action = useAction();
  return (
    <Dialog title={`Eligibility · ${driver.name}`} onClose={onClose}>
      <p>
        Reimbursement eligibility is separate from dues. An override does not
        grant paid membership.
      </p>
      <label className="field">
        Eligibility
        <select value={value} onChange={(e) => setValue(e.target.value)}>
          <option value="membership">Follow membership approval</option>
          <option value="eligible">Eligible · officer exception</option>
          <option value="ineligible">Ineligible · officer override</option>
        </select>
      </label>
      <label className="field">
        Reason
        <textarea
          value={reason}
          required
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <Message error={action.error} />
      <div className="form-actions">
        <Button variant="quiet" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={action.isPending || !reason.trim()}
          onClick={() => {
            void action
              .mutateAsync({
                url: `/api/admin/quarters/${quarterId}/drivers/${driver.member_id}/eligibility`,
                method: "PUT",
                body: {
                  eligible_override:
                    value === "membership" ? null : value === "eligible",
                  reason,
                },
              })
              .then(onClose)
              .catch(() => {});
          }}
        >
          Save Eligibility
        </Button>
      </div>
    </Dialog>
  );
}
function Payment({ driver, onClose }: { driver: Driver; onClose: () => void }) {
  const form = useForm({
    defaultValues: { paid_on: pacificDate(), reference: "" },
  });
  const action = useAction();
  return (
    <Dialog title={`Record payment · ${driver.name}`} onClose={onClose}>
      <div className="receipt">
        <strong className="payment-amount">{money(driver.allocated)}</strong>
        <p>
          {driver.payout_method || "No payment method saved"} ·{" "}
          {driver.payout_destination || "Ask the driver for their destination"}
          {driver.payout_phone_suffix &&
            ` · phone ending ${driver.payout_phone_suffix}`}
        </p>
      </div>
      <p>
        Send the full amount outside this site, then record the payment here.
      </p>
      <form
        onSubmit={form.handleSubmit(async (body) => {
          await action
            .mutateAsync({
              url: `/api/admin/payouts/${driver.payout_id}/payment`,
              method: "PUT",
              body,
            })
            .then(onClose)
            .catch(() => {});
        })}
      >
        <Field
          label="Paid on"
          type="date"
          required
          max={pacificDate()}
          {...form.register("paid_on")}
        />
        <Field
          label="Payment reference / confirmation"
          required
          maxLength={200}
          {...form.register("reference")}
        />
        <Message error={action.error} />
        <div className="sticky-actions">
          <Button type="button" variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={action.isPending}>Record Full Payment</Button>
        </div>
      </form>
    </Dialog>
  );
}
