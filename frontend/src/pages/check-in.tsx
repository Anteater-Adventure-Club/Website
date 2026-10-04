import { useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Car, Check, CreditCard, Plus } from "lucide-react";
import {
  attendanceLabel,
  clock,
  dateLabel,
  eventURL,
  pacificDate,
  useAction,
  useAPI,
} from "../lib/api";
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
import {
  AddParticipantDialog,
  CarpoolView,
  carName,
  roleName,
} from "../components/operations";
import { SetupQuarter } from "../components/officer-forms";

export function CheckInPicker() {
  const { quarter } = useQuarter();
  const query = useAPI(
    "Page_EventPrivate_",
    `/api/admin/events?quarter_id=${quarter?.id}&limit=200`,
    { enabled: !!quarter },
  );
  const today = pacificDate();
  const rows = (query.data?.items || [])
    .filter(
      (e) => e.signups_enabled && ["published", "completed"].includes(e.state),
    )
    .sort(
      (a, b) =>
        Number(b.state === "published") - Number(a.state === "published") ||
        new Date(a.starts_at).valueOf() - new Date(b.starts_at).valueOf(),
    );
  return (
    <>
      <PageHeading
        title="Check In"
        subtitle="Pick your adventure and open the field desk."
      />
      {!quarter ? (
        <SetupQuarter />
      ) : query.isPending ? (
        <Loading />
      ) : query.error ? (
        <Failure error={query.error} retry={query.refetch} />
      ) : rows.length ? (
        <div className="stack">
          {rows.map((e) => (
            <Panel className="record-card" key={e.id}>
              <div>
                <Pill tone={e.state === "completed" ? "gray" : "green"}>
                  {e.state === "completed"
                    ? "Completed · read-only"
                    : pacificDate(new Date(e.starts_at)) <= today &&
                        pacificDate(new Date(e.ends_at)) >= today
                      ? "Today"
                      : "Upcoming"}
                </Pill>
                <h2>{e.name}</h2>
                <p>
                  {dateLabel(e.starts_at)} ·{" "}
                  {clock(e.departure_at || e.starts_at)} · {e.destination}
                </p>
              </div>
              <Link
                className="button primary"
                to={`${eventURL(e, true)}/check-in`}
              >
                {e.state === "completed" ? "View Check In" : "Open Check In"}
              </Link>
            </Panel>
          ))}
        </div>
      ) : (
        <Empty title="No events to check in">
          Publish a signup-enabled event to open its check-in desk.
        </Empty>
      )}
    </>
  );
}
export function FieldDesk({ seat = false }: { seat?: boolean }) {
  const { id } = useParams();
  const query = useAPI("CheckInView", `/api/admin/events/${id}/check-in`, {
    poll: true,
  });
  const quarters = useAPI("Page_QuarterPrivate_", "/api/admin/quarters");
  const [role, setRole] = useState("ride");
  const [search, setSearch] = useState("");
  const [person, setPerson] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<Schema<"SignupPrivate"> | null>(null);
  const [cards, setCards] = useState(false);
  const [walkIn, setWalkIn] = useState(false);
  if (query.isPending)
    return (
      <div className="page">
        <Loading />
      </div>
    );
  if (query.error && !query.data)
    return (
      <div className="page">
        <Failure error={query.error} retry={query.refetch} />
      </div>
    );
  const data = query.data!;
  const q = quarters.data?.items.find((q) => q.id === data.event.quarter_id);
  const stale = !!query.error || Date.now() - query.dataUpdatedAt > 15000;
  const locked =
    data.event.state !== "published" || q?.state !== "open" || stale;
  const base = eventURL(data.event, true);
  const selected = data.signups.find((s) => s.id === person);
  const rows = data.signups.filter(
    (s) =>
      s.role === role &&
      `${s.name} ${s.email || ""} ${s.phone}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div className="field-desk">
      <header className="desk-header">
        <Link className="text-link" to={base}>
          <ArrowLeft size={18} />
          Manage Event
        </Link>
        <div>
          <h1>{seat ? "Seat Riders" : "Check In"}</h1>
          <p>
            {data.event.name} · Depart {clock(data.event.departure_at)}
          </p>
        </div>
        <Pill tone={locked ? "orange" : "green"}>
          {stale
            ? "Reconnecting"
            : data.event.state === "completed"
              ? "Completed · read-only"
              : q?.state !== "open"
                ? "Quarter frozen"
                : "Live"}
        </Pill>
      </header>
      {stale && (
        <Message
          error={
            query.error ||
            new Error(
              "Updates are delayed. Reconnect before changing attendance or seats.",
            )
          }
        />
      )}
      {data.event.state === "completed" && !data.event.completion && (
        <Message>Attendance not recorded</Message>
      )}
      {seat ? (
        <div className="desk-content">
          <Link className="button secondary" to={`${base}/check-in`}>
            Back to Check In
          </Link>
          <CarpoolView data={data} tap locked={locked} />
        </div>
      ) : (
        <>
          <div className="desk-counters">
            {(["paid", "general"] as const).map((category) => (
              <div key={category} className={`card-counter ${category}`}>
                <small>{category.toUpperCase()} RIDERS · NEXT CARD</small>
                <strong>
                  {data.next_cards[category] === null
                    ? "Out of cards"
                    : `#${data.next_cards[category]}`}
                </strong>
                <span>
                  {
                    data.cards.filter(
                      (c) => c.category === category && !c.voided,
                    ).length
                  }{" "}
                  issued / {data.inventory[category]}
                </span>
              </div>
            ))}
          </div>
          <div className="desk-content">
            <div className="desk-toolbar">
              <div className="tabs ride-role-texture" aria-label="Ride groups">
                {Object.keys(data.counts).map((value) => (
                  <button
                    key={value}
                    className={role === value ? "selected" : ""}
                    aria-pressed={role === value}
                    onClick={() => setRole(value)}
                  >
                    {value === "ride"
                      ? "Riders"
                      : value === "driver"
                        ? "Drivers"
                        : value === "own"
                          ? "Own Ride"
                          : "Unknown"}{" "}
                    <small>
                      {data.counts[value].arrived ?? "—"}/
                      {data.counts[value].registered}
                    </small>
                  </button>
                ))}
              </div>
              <input
                className="desk-search"
                aria-label="Search check-in roster"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find a person…"
              />
              <div className="actions">
                <Button disabled={locked} onClick={() => setWalkIn(true)}>
                  <Plus size={16} />
                  Walk-in
                </Button>
                <Button variant="secondary" onClick={() => setCards(true)}>
                  <CreditCard size={16} />
                  Cards
                </Button>
                <Link className="button secondary" to={`${base}/seat`}>
                  <Car size={16} />
                  Carpools
                </Link>
              </div>
            </div>
            <div className="desk-roster">
              {rows.map((s) => (
                <button
                  key={s.id}
                  className={`checkin-person ${s.checked_in_at ? "arrived" : s.released ? "released" : ""}`}
                  onClick={() => setPerson(s.id)}
                >
                  <span className="person-initials">
                    {s.checked_in_at ? (
                      <Check size={22} />
                    ) : (
                      s.name
                        .split(" ")
                        .slice(0, 2)
                        .map((n) => n[0])
                        .join("")
                    )}
                  </span>
                  <span>
                    <strong>{s.name}</strong>
                    <small>
                      {s.paid ? "Paid Member" : "General Member"}
                      {s.role === "driver" &&
                        ` · ${s.seats === null ? "Passenger seats not recorded" : `${s.seats} seats`} · ${carName(s)}`}
                    </small>
                    <small>
                      {s.attendance_status === "unknown" ||
                      s.attendance_status === "missed"
                        ? attendanceLabel(s)
                        : s.checked_in_at
                          ? `Arrived ${clock(s.checked_in_at)}`
                          : s.extended_until && !s.released
                            ? `Held until ${clock(s.extended_until)}`
                            : s.released
                              ? "Seat priority released"
                              : "Not here yet"}
                    </small>
                  </span>
                  {s.card && (
                    <span className={`card-badge ${s.card.category}`}>
                      #{s.card.number}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {!rows.length && (
              <Empty title={search ? "No match" : "No people in this group"}>
                Try another name or add a walk-in.
              </Empty>
            )}
            <p className="muted live-update">
              Updated {clock(data.server_time)} · Refreshes every 2 seconds
              while visible
            </p>
          </div>
        </>
      )}
      {selected && (
        <PersonCheckIn
          person={selected}
          data={data}
          locked={locked}
          onClose={() => setPerson(null)}
          onReceipt={(value) => {
            setReceipt(value);
            setPerson(null);
          }}
        />
      )}
      {receipt && <Receipt person={receipt} onClose={() => setReceipt(null)} />}
      {cards && (
        <Cards data={data} locked={locked} onClose={() => setCards(false)} />
      )}
      {walkIn && (
        <AddParticipantDialog
          event={data.event}
          walkIn
          onClose={() => setWalkIn(false)}
          onReceipt={setReceipt}
        />
      )}
    </div>
  );
}
function PersonCheckIn({
  person,
  data,
  locked,
  onClose,
  onReceipt,
}: {
  person: Schema<"SignupPrivate">;
  data: Schema<"CheckInView">;
  locked: boolean;
  onClose: () => void;
  onReceipt: (value: Schema<"SignupPrivate">) => void;
}) {
  const action = useAction<Schema<"SignupPrivate">>();
  const [extension, setExtension] = useState(false);
  const [undo, setUndo] = useState(false);
  const category = person.paid ? "paid" : "general";
  const next = data.next_cards[category];
  return (
    <Dialog title={person.name} onClose={onClose}>
      <div className="actions">
        <Pill>{person.paid ? "Paid Member" : "General Member"}</Pill>
        <Pill>{roleName(person.role)}</Pill>
      </div>
      <p>
        {person.email || "No email saved"} · {person.phone || "No phone saved"}
      </p>
      {person.role === "driver" && (
        <Panel>
          <h3>{carName(person)}</h3>
          <p>
            {person.vehicle?.plate} · {person.seats} passenger seats
          </p>
        </Panel>
      )}
      {person.checked_in_at ? (
        <div className="receipt">
          <Check size={34} />
          <h3>Already checked in</h3>
          {person.card ? (
            <strong className={`receipt-number ${person.card.category}`}>
              #{person.card.number}
            </strong>
          ) : (
            <p>
              {person.role === "driver"
                ? "Driver arrived · car ready for riders"
                : "Own ride · no card needed"}
            </p>
          )}
          <p>{clock(person.checked_in_at)}</p>
        </div>
      ) : person.role === "ride" ? (
        <div className="receipt">
          <small>NEXT {category.toUpperCase()} CARD · PREVIEW</small>
          <strong className={`receipt-number ${category}`}>
            {next === null ? "Out of cards" : `#${next}`}
          </strong>
          <p className="muted">
            The confirmed number is assigned when you check in. Another desk may
            issue this card first.
          </p>
          {next !== null && (
            <Button
              variant="quiet"
              disabled={locked || action.isPending}
              onClick={() => {
                void action
                  .mutateAsync({
                    url: `/api/admin/events/${data.event.id}/cards/void`,
                    body: {
                      category,
                      number: next,
                      expected_revision: data.revision,
                    },
                  })
                  .catch(() => {});
              }}
            >
              This Card Is Missing · Skip It
            </Button>
          )}
        </div>
      ) : (
        <Message>
          {person.role === "driver"
            ? "Checks in the driver, opens their car, and records a driving trip."
            : "Checks in attendance without issuing a rider card."}
        </Message>
      )}
      {person.notes && <p className="notice">{person.notes}</p>}
      {person.released && (
        <Message>
          The ride priority has expired. Officers can still check this person in
          if seats are available.
        </Message>
      )}
      <Message error={action.error} />
      <div className="sticky-actions">
        <Button variant="quiet" onClick={onClose}>
          Close
        </Button>
        {!person.checked_in_at ? (
          <Button
            disabled={
              locked ||
              action.isPending ||
              (person.role === "ride" && next === null)
            }
            onClick={() => {
              void action
                .mutateAsync({
                  url: `/api/admin/signups/${person.id}/check-in`,
                })
                .then(onReceipt)
                .catch(() => {});
            }}
          >
            Confirm Check In
          </Button>
        ) : (
          <Button
            variant="danger"
            disabled={locked}
            onClick={() => setUndo(true)}
          >
            Undo Check In
          </Button>
        )}
      </div>
      {person.role === "ride" && !person.checked_in_at && (
        <Button
          variant="secondary"
          disabled={locked || !data.extension_chips.length}
          onClick={() => setExtension(true)}
        >
          Hold Their Seat a Little Longer
        </Button>
      )}
      {extension && (
        <Extension
          person={person}
          chips={data.extension_chips}
          onClose={() => setExtension(false)}
        />
      )}
      {undo && (
        <Dialog title="Undo this check-in?" onClose={() => setUndo(false)}>
          <p>
            This voids the issued card permanently and removes seat assignments.
            Edited driver trips are kept.
          </p>
          <Message error={action.error} />
          <div className="form-actions">
            <Button variant="quiet" onClick={() => setUndo(false)}>
              Keep Check In
            </Button>
            <Button
              variant="danger"
              disabled={action.isPending}
              onClick={() => {
                void action
                  .mutateAsync({
                    url: `/api/admin/signups/${person.id}/check-in`,
                    method: "DELETE",
                  })
                  .then(onClose)
                  .catch(() => {});
              }}
            >
              Undo Check In
            </Button>
          </div>
        </Dialog>
      )}
    </Dialog>
  );
}
function Receipt({
  person,
  onClose,
}: {
  person: Schema<"SignupPrivate">;
  onClose: () => void;
}) {
  return (
    <Dialog title="Checked in!" onClose={onClose}>
      <div className="receipt">
        <Check size={40} />
        <h3>{person.name}</h3>
        <Pill>{roleName(person.role)}</Pill>
        {person.card ? (
          <>
            <small>
              {person.card.category.toUpperCase()} RIDER · CONFIRMED CARD
            </small>
            <strong className={`receipt-number ${person.card.category}`}>
              #{person.card.number}
            </strong>
            <p>Hand them this card, then send them to the carpool desk.</p>
          </>
        ) : (
          <p>
            {person.role === "driver"
              ? `${carName(person)} · ${person.seats} seats. Your car is ready to fill.`
              : "Own ride recorded. No rider card needed."}
          </p>
        )}
        <p>{clock(person.checked_in_at)}</p>
        <Button onClick={onClose}>Done</Button>
      </div>
    </Dialog>
  );
}
function Extension({
  person,
  chips,
  onClose,
}: {
  person: Schema<"SignupPrivate">;
  chips: string[];
  onClose: () => void;
}) {
  const [until, setUntil] = useState("");
  const [reason, setReason] = useState("");
  const action = useAction();
  return (
    <Dialog title={`Extend ${person.name}’s seat hold`} onClose={onClose}>
      <p>Choose a quick time and record why they’re running late.</p>
      <div className="segmented">
        {chips.map((chip) => (
          <button
            type="button"
            key={chip}
            aria-pressed={until === chip}
            onClick={() => setUntil(chip)}
          >
            {clock(chip)}
          </button>
        ))}
      </div>
      <label className="field">
        Reason
        <textarea
          required
          value={reason}
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
          disabled={
            action.isPending || !reason.trim() || !chips.includes(until)
          }
          onClick={() => {
            void action
              .mutateAsync({
                url: `/api/admin/signups/${person.id}/extension`,
                body: { until, reason },
              })
              .then(onClose)
              .catch(() => {});
          }}
        >
          Extend Hold
        </Button>
      </div>
    </Dialog>
  );
}
function Cards({
  data,
  locked,
  onClose,
}: {
  data: Schema<"CheckInView">;
  locked: boolean;
  onClose: () => void;
}) {
  const [paid, setPaid] = useState(String(data.inventory.paid));
  const [general, setGeneral] = useState(String(data.inventory.general));
  const [category, setCategory] = useState("paid");
  const [number, setNumber] = useState("");
  const action = useAction();
  return (
    <Dialog title="Rider cards" onClose={onClose} wide>
      <p>
        Paid and general riders have separate numbering. Drivers and own-ride
        attendees do not receive cards.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await action
            .mutateAsync({
              url: `/api/admin/events/${data.event.id}/cards`,
              method: "PUT",
              body: {
                paid_cards: Number(paid),
                general_cards: Number(general),
                expected_revision: data.revision,
              },
            })
            .catch(() => {});
        }}
      >
        <div className="form-grid">
          <Field
            label="Paid card inventory"
            type="number"
            min={0}
            max={10000}
            required
            disabled={locked}
            value={paid}
            onChange={(e) => setPaid(e.target.value)}
          />
          <Field
            label="General card inventory"
            type="number"
            min={0}
            max={10000}
            required
            disabled={locked}
            value={general}
            onChange={(e) => setGeneral(e.target.value)}
          />
        </div>
        <Button disabled={locked || action.isPending}>Save Inventory</Button>
      </form>
      <hr />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await action
            .mutateAsync({
              url: `/api/admin/events/${data.event.id}/cards/void`,
              body: {
                category,
                number: Number(number),
                expected_revision: data.revision,
              },
            })
            .then(() => setNumber(""))
            .catch(() => {});
        }}
      >
        <h3>Void a missing card</h3>
        <div className="form-grid">
          <label className="field">
            Category
            <select
              disabled={locked}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="paid">Paid</option>
              <option value="general">General</option>
            </select>
          </label>
          <Field
            label="Card number"
            type="number"
            min={1}
            required
            disabled={locked}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
        </div>
        <Button variant="secondary" disabled={locked || action.isPending}>
          Void Missing Card
        </Button>
      </form>
      <Message error={action.error} />
      <h3 className="section">Issued & voided cards</h3>
      <div className="scroll-list">
        {data.cards.map((card) => (
          <div className="history-row" key={`${card.category}-${card.number}`}>
            <strong>
              {card.category} #{card.number}
            </strong>
            <span>
              {card.voided
                ? "Voided · never reused"
                : data.signups.find((s) => s.id === card.signup_id)?.name ||
                  "Issued"}
            </span>
          </div>
        ))}
        {!data.cards.length && <p className="muted">No cards issued yet.</p>}
      </div>
      <Button className="section" onClick={onClose}>
        Done
      </Button>
    </Dialog>
  );
}
