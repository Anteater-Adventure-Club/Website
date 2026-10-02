import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useForm } from "react-hook-form";
import { ArrowRight, Plus, Upload } from "lucide-react";
import {
  attendanceLabel,
  dateLabel,
  eventURL,
  money,
  pacificDate,
  useAction,
  useAPI,
} from "../lib/api";
import type { AdminEvent, Person, Schema } from "../lib/api";
import { quarterURL, useQuarter } from "../lib/context";
import {
  Button,
  Dialog,
  Empty,
  EventCard,
  Failure,
  Field,
  Loading,
  Message,
  PageHeading,
  Panel,
  Pill,
} from "../components/ui";
import {
  ImportDialog,
  DeleteDraftButton,
  PersonDialog,
  SetupQuarter,
} from "../components/officer-forms";

export function AdminOverview() {
  const { quarter } = useQuarter();
  const query = useAPI(
    "AdminOverview",
    `/api/admin/overview${quarter ? `?quarter_id=${quarter.id}` : ""}`,
  );
  if (query.isPending) return <Loading />;
  if (query.error) return <Failure error={query.error} retry={query.refetch} />;
  const stats = query.data.statistics;
  const today = pacificDate();
  const todays = query.data.events.filter(
    (e) =>
      e.starts_at &&
      pacificDate(new Date(e.starts_at)) <= today &&
      pacificDate(new Date(e.ends_at)) >= today,
  );
  return (
    <>
      <PageHeading
        title="Dashboard"
        subtitle={
          quarter
            ? `${quarter.name} · Good adventures start with a little coordination.`
            : "Welcome to AAC Officer Tools."
        }
      >
        {quarter && (
          <Pill tone="gray">Lifetime members: {stats.members ?? 0}</Pill>
        )}
      </PageHeading>
      {!quarter ? (
        <SetupQuarter />
      ) : (
        <>
          <div className="stat-grid">
            {[
              ["Quarterly members", stats.quarter_members ?? 0],
              ["Paid members", stats.paid || 0],
              ["Dues collected", money(stats.dues_collected as string)],
              [
                "Ride budget",
                query.data.reimbursement_data_available
                  ? money(stats.budget as string)
                  : "Not recorded",
              ],
            ].map(([label, value]) => (
              <Panel key={label}>
                <small>{label}</small>
                <strong>{value}</strong>
              </Panel>
            ))}
          </div>
          <div className="split-layout section">
            <section>
              <h2>{todays.length ? "Today" : "Coming up"}</h2>
              <div className="stack">
                {(todays.length ? todays : query.data.events)
                  .slice(0, 3)
                  .map((e) => (
                    <Panel key={e.id}>
                      <EventCard event={e} admin />
                      {e.signups_enabled && (
                        <div className="actions">
                          <Link
                            className="button primary"
                            to={`${eventURL(e, true)}/check-in`}
                          >
                            Open Check In
                          </Link>
                          <Link
                            className="button secondary"
                            to={eventURL(e, true)}
                          >
                            Manage Event
                          </Link>
                        </div>
                      )}
                    </Panel>
                  ))}
                {!query.data.events.length && (
                  <Empty
                    title="Time for a new adventure"
                    action={
                      <Link
                        to={quarterURL("/admin/events/new", quarter.id)}
                        className="button primary"
                      >
                        Create an Event
                      </Link>
                    }
                  >
                    Published upcoming events will appear here.
                  </Empty>
                )}
              </div>
            </section>
            <section>
              <h2>Needs your attention</h2>
              <div className="stack">
                {query.data.attention.map((item, i) => (
                  <Link
                    className="panel attention-link"
                    key={i}
                    to={quarterURL(item.url, quarter.id)}
                  >
                    <Pill tone={item.kind === "dues" ? "yellow" : "orange"}>
                      {item.count}
                    </Pill>
                    <span>{item.title}</span>
                    <ArrowRight size={18} />
                  </Link>
                ))}
                {!query.data.attention.length && (
                  <Panel>
                    <h3>All set!</h3>
                    <p className="muted">
                      No pending dues, drafts, paid-seat shortages, or missing
                      recaps.
                    </p>
                  </Panel>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </>
  );
}

export function AdminEvents() {
  const { quarter } = useQuarter();
  const [filter, setFilter] = useState("upcoming");
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState<AdminEvent | null>(null);
  const query = useAPI(
    "Page_EventPrivate_",
    `/api/admin/events?quarter_id=${quarter?.id}&limit=200`,
    { enabled: !!quarter },
  );
  const action = useAction();
  const now = new Date();
  const filtered = (query.data?.items || []).filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "all" || filter === "draft"
        ? filter === "all" || e.state === "draft"
        : filter === "past"
          ? new Date(e.ends_at) < now ||
            ["completed", "cancelled"].includes(e.state)
          : e.state === "published" && new Date(e.ends_at) >= now),
  );
  const rows: AdminEvent[] = [];
  const seen = new Set<number>();
  for (const e of filtered) {
    if (e.series_id) {
      if (seen.has(e.series_id)) continue;
      seen.add(e.series_id);
    }
    rows.push(e);
  }
  return (
    <>
      <PageHeading
        title="Events"
        subtitle="Plan adventures, organize rides, and keep the club in the loop."
      >
        <Link
          className="button primary"
          to={quarterURL("/admin/events/new", quarter?.id)}
        >
          <Plus size={16} />
          New Event
        </Link>
      </PageHeading>
      {!quarter ? (
        <SetupQuarter />
      ) : (
        <>
          <div className="filters">
            <input
              aria-label="Search events"
              placeholder="Search events…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {[
              ["upcoming", "Upcoming"],
              ["draft", "Drafts"],
              ["past", "Past"],
              ["all", "All"],
            ].map(([value, label]) => (
              <Button
                key={value}
                variant="secondary"
                className={filter === value ? "selected" : ""}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </Button>
            ))}
          </div>
          {query.isPending ? (
            <Loading />
          ) : query.error ? (
            <Failure error={query.error} retry={query.refetch} />
          ) : rows.length ? (
            <div className="stack">
              {rows.map((e) => (
                <Panel
                  className="record-card"
                  key={e.series_id ? `series-${e.series_id}` : e.id}
                >
                  <div>
                    <div className="actions">
                      <Pill
                        tone={
                          e.state === "draft"
                            ? "yellow"
                            : e.state === "cancelled"
                              ? "orange"
                              : "green"
                        }
                      >
                        {e.state}
                      </Pill>
                      {e.series_id && <Pill>Recurring series</Pill>}
                      {!e.signups_enabled && (
                        <Pill tone="gray">No signups</Pill>
                      )}
                    </div>
                    <h3>{e.name}</h3>
                    <p>
                      {dateLabel(e.starts_at)} ·{" "}
                      {e.destination || "Location pending"}
                    </p>
                    {e.series_id && (
                      <Link
                        className="text-link"
                        to={`/admin/series/${e.series_id}`}
                      >
                        View all dates →
                      </Link>
                    )}
                  </div>
                  <div className="actions">
                    <Link className="button primary" to={eventURL(e, true)}>
                      Manage
                    </Link>
                    {quarter.state === "open" &&
                      !["completed", "cancelled"].includes(e.state) && (
                        <Link
                          className="button secondary"
                          to={
                            e.series_id
                              ? `/admin/series/${e.series_id}/edit`
                              : `${eventURL(e, true)}/edit`
                          }
                        >
                          Edit
                        </Link>
                      )}
                    {e.state === "draft" && !e.series_id && (
                      <Button variant="secondary" onClick={() => setConfirm(e)}>
                        Publish
                      </Button>
                    )}
                    {quarter.state === "open" &&
                      e.state === "draft" &&
                      !e.series_id && (
                        <DeleteDraftButton
                          url={`/api/admin/events/${e.id}`}
                          revision={e.revision}
                          name={e.name}
                          quarterId={e.quarter_id}
                        />
                      )}
                  </div>
                </Panel>
              ))}
            </div>
          ) : (
            <Empty
              title="No events here yet"
              action={
                <Link
                  className="button primary"
                  to={quarterURL("/admin/events/new", quarter.id)}
                >
                  Create an Event
                </Link>
              }
            >
              Try a different filter or start planning the next adventure.
            </Empty>
          )}
        </>
      )}
      {confirm && (
        <Dialog title="Publish this event?" onClose={() => setConfirm(null)}>
          <p>{confirm.name} will appear on the public calendar.</p>
          <Message error={action.error} />
          <div className="form-actions">
            <Button variant="quiet" onClick={() => setConfirm(null)}>
              Keep Draft
            </Button>
            <Button
              disabled={action.isPending}
              onClick={() => {
                void action
                  .mutateAsync({
                    url: `/api/admin/events/${confirm.id}/state`,
                    body: {
                      state: "published",
                      expected_revision: confirm.revision,
                    },
                  })
                  .then(() => setConfirm(null))
                  .catch(() => {});
              }}
            >
              Publish Event
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}

function QuarterDialog({
  quarter,
  previous,
  onClose,
}: {
  quarter?: Schema<"QuarterPrivate">;
  previous?: Schema<"QuarterPrivate">;
  onClose: () => void;
}) {
  const form = useForm<Schema<"QuarterWrite">>({
    defaultValues: {
      name: quarter?.name || "",
      starts_on: quarter?.starts_on || "",
      ends_on: quarter?.ends_on || "",
      budget: quarter?.budget || previous?.budget || "0.00",
      driver_cap: quarter?.driver_cap || previous?.driver_cap || "0.00",
      mpg: quarter?.mpg || previous?.mpg || "25.00",
      expected_revision: quarter?.revision,
    },
  });
  const action = useAction<Schema<"QuarterPrivate">>();
  const { select } = useQuarter();
  return (
    <Dialog
      title={quarter ? `Edit ${quarter.name}` : "New Quarter"}
      onClose={onClose}
    >
      <form
        onSubmit={form.handleSubmit(async (body) => {
          await action
            .mutateAsync({
              url: `/api/admin/quarters${quarter ? `/${quarter.id}` : ""}`,
              method: quarter ? "PUT" : "POST",
              body,
            })
            .then((q) => {
              select(String(q.id));
              onClose();
            })
            .catch(() => {});
        })}
      >
        <Field
          label="Quarter name"
          required
          maxLength={100}
          {...form.register("name")}
        />
        <div className="form-grid">
          <Field
            label="Starts on"
            type="date"
            required
            {...form.register("starts_on")}
          />
          <Field
            label="Ends on"
            type="date"
            required
            {...form.register("ends_on")}
          />
          <Field
            label="Ride budget ($)"
            type="number"
            min={0}
            step=".01"
            required
            {...form.register("budget")}
          />
          <Field
            label="Per-driver cap ($)"
            type="number"
            min={0}
            step=".01"
            required
            hint="0 means no cap"
            {...form.register("driver_cap")}
          />
          <Field
            label="Standard MPG"
            type="number"
            min={1}
            max={200}
            step=".01"
            required
            {...form.register("mpg")}
          />
        </div>
        {!quarter && (
          <Message>
            Only financial defaults are copied. This quarter starts without
            members, events, trips, or carried balances.
          </Message>
        )}
        <Message error={action.error} />
        <div className="sticky-actions">
          <Button type="button" variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={action.isPending}>
            {quarter ? "Save Quarter" : "Create Quarter"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function Settings() {
  const { quarter } = useQuarter();
  const query = useAPI("Page_QuarterPrivate_", "/api/admin/quarters");
  const [editing, setEditing] = useState<
    Schema<"QuarterPrivate"> | "new" | null
  >(null);
  if (query.isPending) return <Loading />;
  if (query.error) return <Failure error={query.error} retry={query.refetch} />;
  const selected = query.data.items.find((q) => q.id === quarter?.id);
  return (
    <>
      <PageHeading
        title="Settings"
        subtitle="Each quarter gets its own dates, memberships, and reimbursement budget."
      >
        <Button onClick={() => setEditing("new")}>
          <Plus size={16} />
          New Quarter
        </Button>
      </PageHeading>
      {query.data.items.length ? (
        <div className="stack">
          {query.data.items.map((q) => (
            <Panel key={q.id} className="record-card">
              <div>
                <Pill tone={q.state === "open" ? "green" : "gray"}>
                  {q.state}
                </Pill>
                <h3>{q.name}</h3>
                <p>
                  {dateLabel(q.starts_on)} –{" "}
                  {dateLabel(q.ends_on, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                <p>
                  Budget {money(q.budget)} · Driver cap{" "}
                  {Number(q.driver_cap) ? money(q.driver_cap) : "None"} ·{" "}
                  {q.mpg} MPG
                </p>
              </div>
              {q.state === "open" ? (
                <Button variant="secondary" onClick={() => setEditing(q)}>
                  Edit Quarter
                </Button>
              ) : (
                <Link
                  className="button secondary"
                  to={quarterURL("/admin/reimbursements", q.id)}
                >
                  View History
                </Link>
              )}
            </Panel>
          ))}
        </div>
      ) : (
        <Empty
          title="Start your first quarter"
          action={
            <Button onClick={() => setEditing("new")}>Create Quarter</Button>
          }
        >
          Choose dates and a budget before publishing events or approving
          membership.
        </Empty>
      )}
      {editing && (
        <QuarterDialog
          quarter={editing === "new" ? undefined : editing}
          previous={selected}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function DuesDialog({
  person,
  membership,
  quarterId,
  onClose,
}: {
  person: Person;
  membership?: Schema<"MembershipView"> | null;
  quarterId: number;
  onClose: () => void;
}) {
  const [category, setCategory] = useState(
    membership?.source === "exception"
      ? "exception"
      : membership?.student === false
        ? "non-student"
        : "student",
  );
  const form = useForm<Schema<"MembershipDecision">>({
    defaultValues: {
      category: "payment",
      student: membership?.student ?? person.student,
      amount: membership?.student === false ? "30.00" : "25.00",
      paid_on: pacificDate(),
      method: (membership?.method ||
        "cash") as Schema<"MembershipDecision">["method"],
      reference: "",
      reason: "",
    },
  });
  const action = useAction();
  const payment = ["student", "non-student"].includes(category);
  return (
    <Dialog title={`Record dues · ${person.name}`} onClose={onClose}>
      <form
        onSubmit={form.handleSubmit(async (fields) => {
          const body = {
            ...fields,
            category: payment ? "payment" : category,
            student: category !== "non-student",
            amount: payment ? fields.amount : null,
            paid_on: payment ? fields.paid_on : null,
            method: payment ? fields.method : null,
          };
          await action
            .mutateAsync({
              url: `/api/admin/members/${person.id}/memberships/${quarterId}/decision`,
              body,
            })
            .then(onClose)
            .catch(() => {});
        })}
      >
        <p className="muted">
          Confirm payment made outside the site, or approve a reasoned
          exception.
        </p>
        <label className="field">
          Membership category
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              if (
                e.target.value === "student" ||
                e.target.value === "non-student"
              )
                form.setValue(
                  "amount",
                  e.target.value === "student" ? "25.00" : "30.00",
                );
            }}
          >
            <option value="student">Student · $25</option>
            <option value="non-student">Non-student · $30</option>
            <option value="exception">Exception · $0</option>
            <option value="general">Return to General Membership</option>
          </select>
        </label>
        {payment ? (
          <>
            <div className="form-grid">
              <Field
                label="Amount received ($)"
                type="number"
                min=".01"
                step=".01"
                required
                {...form.register("amount")}
              />
              <Field
                label="Paid on"
                type="date"
                max={pacificDate()}
                required
                {...form.register("paid_on")}
              />
              <label className="field">
                Payment method
                <select {...form.register("method")}>
                  <option value="cash">Cash</option>
                  <option value="venmo">Venmo</option>
                  <option value="zelle">Zelle</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <Field
                label="Reference"
                maxLength={200}
                {...form.register("reference")}
              />
            </div>
          </>
        ) : (
          <Message>
            {category === "exception"
              ? "An exception grants full membership benefits without adding a payment receipt or collected dollars."
              : "This returns the member to general benefits and voids active dues receipts while preserving history."}
          </Message>
        )}
        <label className="field">
          Notes / reason
          <textarea
            required={!payment || membership?.status === "approved"}
            maxLength={500}
            {...form.register("reason")}
            placeholder={
              membership?.status === "approved"
                ? "Explain the correction"
                : "Explain the exception or add payment notes"
            }
          />
        </label>
        <Message error={action.error} />
        <div className="sticky-actions">
          <Button type="button" variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={action.isPending}>
            {payment
              ? "Confirm Payment"
              : category === "exception"
                ? "Approve $0 Exception"
                : "Save Adjustment"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function MemberDetailDialog({
  memberId,
  quarterId,
  onClose,
}: {
  memberId: number;
  quarterId?: number;
  onClose: () => void;
}) {
  const query = useAPI(
    "MemberDetail",
    `/api/admin/members/${memberId}${quarterId ? `?quarter_id=${quarterId}` : ""}`,
  );
  const [dues, setDues] = useState(false);
  const { quarter } = useQuarter();
  return (
    <Dialog
      title={query.data?.member.name || "Member details"}
      onClose={onClose}
      wide
    >
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <Failure error={query.error} retry={query.refetch} />
      ) : (
        <>
          <div className="details-grid">
            <p>
              <small>Email</small>
              {query.data.member.email || "Not provided"}
            </p>
            <p>
              <small>Phone</small>
              {query.data.member.phone || "Not provided"}
            </p>
            <p>
              <small>Discord</small>
              {query.data.member.discord || "Not provided"}
            </p>
            <p>
              <small>Reimbursement destination · private</small>
              {query.data.member.payout_method || "Not provided"}
              {query.data.member.payout_destination &&
                ` · ${query.data.member.payout_destination}`}
              {query.data.member.payout_phone_suffix &&
                ` · ending ${query.data.member.payout_phone_suffix}`}
            </p>
          </div>
          <hr />
          <div className="section-heading">
            <h3>Membership · {quarter?.name || "No quarter"}</h3>
            {quarter?.state === "open" && (
              <Button variant="secondary" onClick={() => setDues(true)}>
                Record / Correct Dues
              </Button>
            )}
          </div>
          <Pill
            tone={
              query.data.membership?.status === "approved"
                ? "solid"
                : query.data.membership?.status === "pending"
                  ? "yellow"
                  : "green"
            }
          >
            {query.data.membership?.source === "exception"
              ? "Exception · $0"
              : query.data.membership?.status || "general"}
          </Pill>
          {query.data.membership?.reason && (
            <p className="notice">{query.data.membership.reason}</p>
          )}
          <section className="section">
            <h3>Dues history</h3>
            {query.data.memberships
              .flatMap((m) =>
                m.receipts.map((r) => ({ ...r, quarter_id: m.quarter_id })),
              )
              .map((r) => (
                <div className="history-row" key={r.id}>
                  <strong>{money(r.amount)}</strong>
                  <span>
                    {dateLabel(r.paid_on)} · {r.method} · {r.reference}
                  </span>
                  {r.voided && <Pill tone="gray">Corrected</Pill>}
                  {r.reason && <small>{r.reason}</small>}
                </div>
              ))}
            {!query.data.memberships.some((m) => m.receipts.length) && (
              <p className="muted">
                No payment receipts recorded. Imported or exception approvals do
                not invent receipts.
              </p>
            )}
          </section>
          <section className="section">
            <h3>Event history</h3>
            <div className="stack">
              {query.data.signups
                .filter((s) => s.event)
                .map((s) => (
                  <Link
                    className="history-row"
                    key={s.id}
                    to={eventURL(s.event!, true)}
                    onClick={onClose}
                  >
                    <strong>{s.event!.name}</strong>
                    <span>
                      {dateLabel(s.event!.starts_at)} ·{" "}
                      {s.role === "ride"
                        ? "Needs ride"
                        : s.role === "driver"
                          ? "Driving"
                          : s.role === "own"
                            ? "Own ride"
                            : "Transportation not recorded"}{" "}
                      · {attendanceLabel(s)}
                    </span>
                  </Link>
                ))}
            </div>
          </section>
          {dues && quarterId && (
            <DuesDialog
              person={query.data.member}
              membership={query.data.membership}
              quarterId={quarterId}
              onClose={() => setDues(false)}
            />
          )}
        </>
      )}
    </Dialog>
  );
}

export function Members() {
  const { quarter } = useQuarter();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const status = params.get("status") || "all";
  const [offset, setOffset] = useState(0);
  const query = useAPI(
    "MemberList",
    `/api/admin/members?limit=50&offset=${offset}&status=${status}&search=${encodeURIComponent(search)}${quarter ? `&quarter_id=${quarter.id}` : ""}`,
  );
  const [add, setAdd] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [dues, setDues] = useState<Schema<"MemberListRow"> | null>(null);
  function filter(value: string) {
    const next = new URLSearchParams(params);
    next.set("status", value);
    setParams(next);
    setOffset(0);
  }
  return (
    <>
      <PageHeading
        title="Members"
        subtitle="Confirm dues, welcome new people, and find their club history."
      >
        <Button
          variant="secondary"
          disabled={!quarter || quarter.state !== "open"}
          onClick={() => setImporting(true)}
        >
          <Upload size={16} />
          Import
        </Button>
        <Button onClick={() => setAdd(true)}>
          <Plus size={16} />
          Add Member
        </Button>
      </PageHeading>
      <div className="filters">
        <input
          aria-label="Search members"
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOffset(0);
          }}
        />
        {[
          ["all", "All"],
          ["pending", "Pending"],
          ["paid", "Paid"],
          ["exception", "Exception"],
          ["general", "General"],
        ].map(([value, label]) => (
          <Button
            key={value}
            variant="secondary"
            className={status === value ? "selected" : ""}
            aria-pressed={status === value}
            onClick={() => filter(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <Failure error={query.error} retry={query.refetch} />
      ) : query.data.items.length ? (
        <>
          <div className="table-wrapper">
            <table className="record-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Membership</th>
                  <th>Submitted / method</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((row) => (
                  <tr key={row.member.id}>
                    <td data-label="Member">
                      <div>
                        <strong>{row.member.name}</strong>
                        <small>{row.member.email || "No email saved"}</small>
                      </div>
                    </td>
                    <td data-label="Membership">
                      <Pill
                        tone={
                          row.membership?.status === "approved"
                            ? "solid"
                            : row.membership?.status === "pending"
                              ? "yellow"
                              : "green"
                        }
                      >
                        {row.membership?.source === "exception"
                          ? "Exception"
                          : row.membership?.status === "approved"
                            ? "Paid Member"
                            : row.membership?.status === "pending"
                              ? "Pending"
                              : "General"}
                      </Pill>
                    </td>
                    <td data-label="Submitted">
                      <div>
                        {row.membership?.submitted_at
                          ? dateLabel(row.membership.submitted_at)
                          : "—"}
                        <small>
                          {row.membership?.method || "No payment submitted"}
                        </small>
                      </div>
                    </td>
                    <td data-label="Actions">
                      <div className="actions">
                        <Button
                          variant="quiet"
                          onClick={() => setSelected(row.member.id)}
                        >
                          Details
                        </Button>
                        {quarter?.state === "open" && (
                          <Button
                            variant="secondary"
                            onClick={() => setDues(row)}
                          >
                            {row.membership?.status === "pending"
                              ? "Confirm Dues"
                              : "Record Dues"}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="toolbar">
            <small className="muted">
              {offset + 1}–{Math.min(offset + 50, query.data.total)} of{" "}
              {query.data.total} members
            </small>
            <div className="actions">
              <Button
                variant="secondary"
                disabled={offset === 0}
                onClick={() => setOffset(offset - 50)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                disabled={offset + 50 >= query.data.total}
                onClick={() => setOffset(offset + 50)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      ) : (
        <Empty
          title="No members match"
          action={<Button onClick={() => setAdd(true)}>Add a Member</Button>}
        >
          Try another search or filter.
        </Empty>
      )}
      {add && <PersonDialog onClose={() => setAdd(false)} />}
      {importing && quarter && (
        <ImportDialog
          quarterId={quarter.id}
          onClose={() => setImporting(false)}
        />
      )}
      {selected && (
        <MemberDetailDialog
          memberId={selected}
          quarterId={quarter?.id}
          onClose={() => setSelected(null)}
        />
      )}
      {dues && quarter && (
        <DuesDialog
          person={dues.member}
          membership={dues.membership}
          quarterId={quarter.id}
          onClose={() => setDues(null)}
        />
      )}
    </>
  );
}
