import { useState } from "react";
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";
import { useForm } from "react-hook-form";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Pencil,
  Plus,
  Upload,
} from "lucide-react";
import {
  attendanceLabel,
  clock,
  dateRange,
  eventURL,
  fromPacific,
  money,
  pacificInput,
  photoURL,
  request,
  useAction,
  useAPI,
} from "../lib/api";
import type { AdminEvent, Person, Schema } from "../lib/api";
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
  Polaroid,
} from "../components/ui";
import {
  ImageUpload,
  ImportDialog,
  PersonDialog,
} from "../components/officer-forms";
import {
  AddParticipantDialog,
  CarpoolView,
  carName,
  roleName,
} from "../components/operations";

export function EventManagement() {
  const { id, slug } = useParams();
  const [params, setParams] = useSearchParams();
  const query = useAPI("EventPrivate", `/api/admin/events/${id}`);
  const quarters = useAPI("Page_QuarterPrivate_", "/api/admin/quarters");
  const [dialog, setDialog] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const action = useAction<AdminEvent>();
  const navigate = useNavigate();
  if (query.isPending) return <Loading />;
  if (query.error) return <Failure error={query.error} retry={query.refetch} />;
  const event = query.data;
  const base = eventURL(event, true);
  if (slug !== event.slug)
    return (
      <Navigate replace to={`${base}${params.size ? `?${params}` : ""}`} />
    );
  const q = quarters.data?.items.find((q) => q.id === event.quarter_id);
  const operational = event.state === "published" && q?.state === "open";
  const editable =
    !["completed", "cancelled"].includes(event.state) && q?.state === "open";
  const tabs = event.signups_enabled
    ? [
        ["signups", "Signups"],
        ["carpools", "Carpools"],
        ["check-in-log", "Check-in Log"],
        ["questions", "Questions"],
        ["trips", "Trips & Mileage"],
        ["recap", "Recap"],
      ]
    : [["recap", "Recap"]];
  const tab = tabs.some(([value]) => value === params.get("tab"))
    ? params.get("tab")!
    : tabs[0][0];
  function changeTab(value: string) {
    const next = new URLSearchParams(params);
    next.set("tab", value);
    setParams(next);
  }
  return (
    <>
      <Link
        className="text-link"
        to={`/admin/events?quarter=${event.quarter_id}`}
      >
        <ArrowLeft size={16} />
        Events
      </Link>
      <PageHeading
        title={event.name}
        subtitle={`${dateRange(event.starts_at, event.ends_at)}${event.state === "completed" ? "" : ` · ${clock(event.starts_at)}`} · ${event.destination}`}
      >
        <Pill
          tone={
            event.state === "draft"
              ? "yellow"
              : event.state === "cancelled"
                ? "orange"
                : "green"
          }
        >
          {event.state}
        </Pill>
        {editable && (
          <Link className="button secondary" to={`${base}/edit`}>
            <Pencil size={16} />
            Edit This Date
          </Link>
        )}
        {event.signups_enabled &&
          event.state !== "draft" &&
          event.state !== "cancelled" && (
            <Link className="button primary" to={`${base}/check-in`}>
              Open Check In
            </Link>
          )}
      </PageHeading>
      <div className="toolbar">
        <div className="actions">
          {editable && (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setReason("");
                  action.reset();
                  setDialog(
                    event.state === "draft" ? "published" : "completed",
                  );
                }}
              >
                {event.state === "draft" ? "Publish Event" : "Complete Event"}
              </Button>
              <Button
                variant="quiet"
                onClick={() => {
                  action.reset();
                  setDialog("cancelled");
                }}
              >
                Cancel Event
              </Button>
              {event.series_id && (
                <Button variant="quiet" onClick={() => setDialog("skip")}>
                  Skip This Date
                </Button>
              )}
            </>
          )}
          <Button variant="quiet" onClick={() => setDialog("duplicate")}>
            <Copy size={16} />
            Duplicate
          </Button>
          {event.series_id && (
            <Link className="text-link" to={`/admin/series/${event.series_id}`}>
              View Series
            </Link>
          )}
        </div>
        <Link className="text-link" to={eventURL(event)}>
          Public Page ↗
        </Link>
      </div>
      {event.state === "cancelled" && (
        <Message>Cancelled: {event.cancellation_reason}</Message>
      )}
      <nav className="tabs" aria-label="Event management tabs">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            aria-current={tab === value ? "page" : undefined}
            className={tab === value ? "selected" : ""}
            onClick={() => changeTab(value)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="section">
        {tab === "signups" ? (
          <SignupRoster event={event} locked={!editable} />
        ) : tab === "carpools" ? (
          <EventCarpools event={event} locked={!operational} />
        ) : tab === "check-in-log" ? (
          <AttendanceLog event={event} locked={!operational} />
        ) : tab === "questions" ? (
          <Questions event={event} />
        ) : tab === "trips" ? (
          <Trips
            event={event}
            locked={q?.state !== "open"}
            mpg={q?.mpg ?? undefined}
          />
        ) : (
          <Recap event={event} />
        )}
      </div>
      {dialog === "duplicate" ? (
        <Duplicate event={event} onClose={() => setDialog(null)} />
      ) : (
        dialog && (
          <Dialog
            title={
              dialog === "cancelled"
                ? "Cancel this event?"
                : dialog === "completed"
                  ? "Complete this event?"
                  : dialog === "skip"
                    ? "Skip this series date?"
                    : "Publish this event?"
            }
            onClose={() => setDialog(null)}
          >
            <p>
              {dialog === "completed"
                ? "Attendance will be frozen into a completion summary. Check-in and car assignments become read-only. Mileage and recaps can still be edited."
                : dialog === "cancelled"
                  ? "Members will see your cancellation reason. Undo active check-ins before cancelling."
                  : dialog === "skip"
                    ? "This date will disappear from the calendar. Dates with participants must be cancelled with a reason instead."
                    : "This event will become visible on the club calendar."}
            </p>
            {dialog === "cancelled" && (
              <label className="field">
                Cancellation reason
                <textarea
                  value={reason}
                  required
                  maxLength={500}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            )}
            <Message error={action.error} />
            <div className="form-actions">
              <Button variant="quiet" onClick={() => setDialog(null)}>
                Keep Event
              </Button>
              <Button
                variant={dialog === "cancelled" ? "danger" : "primary"}
                disabled={
                  action.isPending || (dialog === "cancelled" && !reason.trim())
                }
                onClick={() => {
                  void action
                    .mutateAsync({
                      url: `/api/admin/events/${event.id}/${dialog === "skip" ? "skip" : "state"}`,
                      body: {
                        ...(dialog === "skip" ? {} : { state: dialog, reason }),
                        expected_revision: event.revision,
                      },
                    })
                    .then(() => {
                      setDialog(null);
                      if (dialog === "skip")
                        navigate(`/admin/series/${event.series_id}`);
                    })
                    .catch(() => {});
                }}
              >
                {dialog === "completed"
                  ? "Complete Event"
                  : dialog === "cancelled"
                    ? "Cancel Event"
                    : dialog === "skip"
                      ? "Skip Date"
                      : "Publish Event"}
              </Button>
            </div>
          </Dialog>
        )
      )}
    </>
  );
}

function Duplicate({
  event,
  onClose,
}: {
  event: AdminEvent;
  onClose: () => void;
}) {
  const quarters = useAPI("Page_QuarterPrivate_", "/api/admin/quarters");
  const form = useForm({
    defaultValues: {
      quarter_id: String(event.quarter_id),
      starts: pacificInput(event.starts_at),
      ends: pacificInput(event.ends_at),
    },
  });
  const [error, setError] = useState<Error | null>(null);
  const action = useAction<AdminEvent>();
  const navigate = useNavigate();
  return (
    <Dialog title="Duplicate event" onClose={onClose}>
      <p>
        Copies event content and settings into a new draft. Participants,
        attendance, trips, and recaps are not copied.
      </p>
      <form
        onSubmit={form.handleSubmit(async (values) => {
          setError(null);
          try {
            await action
              .mutateAsync({
                url: `/api/admin/events/${event.id}/duplicate`,
                body: {
                  quarter_id: Number(values.quarter_id),
                  starts_at: fromPacific(values.starts),
                  ends_at: fromPacific(values.ends),
                },
              })
              .then((e) => {
                onClose();
                navigate(`${eventURL(e, true)}/edit`);
              });
          } catch (err) {
            setError(err as Error);
          }
        })}
      >
        <label className="field">
          Quarter
          <select {...form.register("quarter_id")}>
            {quarters.data?.items
              .filter((q) => q.state === "open")
              .map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name}
                </option>
              ))}
          </select>
        </label>
        <Field
          label="Starts · Pacific"
          type="datetime-local"
          required
          {...form.register("starts")}
        />
        <Field
          label="Ends · Pacific"
          type="datetime-local"
          required
          {...form.register("ends")}
        />
        <Message error={error} />
        <div className="form-actions">
          <Button type="button" variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={action.isPending}>Create Draft Copy</Button>
        </div>
      </form>
    </Dialog>
  );
}

function SignupRoster({
  event,
  locked,
}: {
  event: AdminEvent;
  locked: boolean;
}) {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [offset, setOffset] = useState(0);
  const [add, setAdd] = useState(false);
  const [importing, setImporting] = useState(false);
  const [remove, setRemove] = useState<Schema<"SignupPrivate"> | null>(null);
  const query = useAPI(
    "Page_SignupPrivate_",
    `/api/admin/events/${event.id}/signups?limit=50&offset=${offset}&search=${encodeURIComponent(search)}${role ? `&role=${role}` : ""}`,
  );
  const action = useAction();
  return (
    <>
      <div className="toolbar">
        <div className="filters">
          <input
            aria-label="Search participants"
            placeholder="Search name or email"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
          />
          <select
            aria-label="Ride filter"
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">All rides</option>
            <option value="ride">Riders</option>
            <option value="driver">Drivers</option>
            <option value="own">Own ride</option>
          </select>
        </div>
        <div className="actions">
          <a
            className="button secondary"
            href={`/api/admin/events/${event.id}/signups.csv`}
          >
            <Download size={16} />
            Export CSV
          </a>
          <Button
            variant="secondary"
            disabled={locked}
            onClick={() => setImporting(true)}
          >
            <Upload size={16} />
            Import
          </Button>
          <Button disabled={locked} onClick={() => setAdd(true)}>
            <Plus size={16} />
            Add Person
          </Button>
        </div>
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
                  <th>Person</th>
                  <th>Ride</th>
                  <th>Status</th>
                  <th>Car / notes</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((s) => (
                  <tr key={s.id}>
                    <td data-label="Person">
                      <strong>{s.name}</strong>
                      <small>
                        {s.email} · {s.phone}
                      </small>
                    </td>
                    <td data-label="Ride">
                      {roleName(s.role)}
                      {s.paid && <Pill>Paid</Pill>}
                    </td>
                    <td data-label="Status">
                      {s.released ? "Seat released" : attendanceLabel(s)}
                    </td>
                    <td data-label="Car / notes">
                      {s.role === "driver" && (
                        <small>
                          {carName(s)} ·{" "}
                          {s.seats === null
                            ? "Passenger seats not recorded"
                            : `${s.seats} seats offered`}
                        </small>
                      )}
                      {s.notes}
                    </td>
                    <td data-label="Action">
                      <Button
                        variant="quiet"
                        disabled={locked || !!s.checked_in_at || s.cancelled}
                        onClick={() => {
                          action.reset();
                          setRemove(s);
                        }}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="toolbar">
            <small>{query.data.total} participants</small>
            <div className="actions">
              <Button
                variant="secondary"
                disabled={!offset}
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
        <Empty title="No signups yet">
          Add a person or share the event’s public signup link.
        </Empty>
      )}
      {add && (
        <AddParticipantDialog event={event} onClose={() => setAdd(false)} />
      )}
      {importing && (
        <ImportDialog
          quarterId={event.quarter_id}
          eventId={event.id}
          onClose={() => setImporting(false)}
        />
      )}
      {remove && (
        <Dialog
          title={`Remove ${remove.name}?`}
          onClose={() => setRemove(null)}
        >
          <p>The signup will be cancelled while its history is preserved.</p>
          <Message error={action.error} />
          <div className="form-actions">
            <Button variant="quiet" onClick={() => setRemove(null)}>
              Keep Signup
            </Button>
            <Button
              variant="danger"
              disabled={action.isPending}
              onClick={() => {
                void action
                  .mutateAsync({
                    url: `/api/admin/signups/${remove.id}`,
                    method: "DELETE",
                  })
                  .then(() => setRemove(null))
                  .catch(() => {});
              }}
            >
              Remove Signup
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
function EventCarpools({
  event,
  locked,
}: {
  event: AdminEvent;
  locked: boolean;
}) {
  const query = useAPI(
    "CheckInView",
    `/api/admin/events/${event.id}/check-in`,
    { poll: !locked },
  );
  return query.isPending ? (
    <Loading />
  ) : query.error ? (
    <Failure error={query.error} retry={query.refetch} />
  ) : (
    <CarpoolView data={query.data} locked={locked} />
  );
}
function AttendanceLog({
  event,
  locked,
}: {
  event: AdminEvent;
  locked: boolean;
}) {
  const [offset, setOffset] = useState(0);
  const [undo, setUndo] = useState<Schema<"SignupPrivate"> | null>(null);
  const query = useAPI(
    "Page_AttendanceLogRow_",
    `/api/admin/events/${event.id}/check-in-log?limit=50&offset=${offset}`,
    { poll: !locked },
  );
  const state = useAPI(
    "CheckInView",
    `/api/admin/events/${event.id}/check-in`,
    { poll: !locked },
  );
  const action = useAction();
  return (
    <>
      <h2>Check-in Log</h2>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <Failure error={query.error} retry={query.refetch} />
      ) : query.data.items.length ? (
        <>
          <div className="stack">
            {query.data.items.map((row) => {
              const person = state.data?.signups.find(
                (s) => s.id === row.signup_id,
              );
              return (
                <Panel key={row.id} className="record-card">
                  <div>
                    <strong>{row.name}</strong>
                    <p>
                      {row.action} · {clock(row.at)} · by {row.actor}
                    </p>
                  </div>
                  {row.action === "check-in" && person?.checked_in_at && (
                    <Button
                      variant="secondary"
                      disabled={locked}
                      onClick={() => setUndo(person)}
                    >
                      Undo Check In
                    </Button>
                  )}
                </Panel>
              );
            })}
          </div>
          <div className="form-actions">
            <Button
              variant="secondary"
              disabled={!offset}
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
        </>
      ) : (
        <Empty title="No arrivals yet">
          Check-ins and undo actions appear here with their officer and time.
        </Empty>
      )}
      {undo && (
        <Dialog
          title={`Undo ${undo.name}’s check-in?`}
          onClose={() => setUndo(null)}
        >
          <p>
            The card will be voided permanently, the seat assignment removed,
            and an unedited automatic driver trip removed.
          </p>
          <Message error={action.error} />
          <div className="form-actions">
            <Button variant="quiet" onClick={() => setUndo(null)}>
              Keep Check In
            </Button>
            <Button
              variant="danger"
              disabled={action.isPending}
              onClick={() => {
                void action
                  .mutateAsync({
                    url: `/api/admin/signups/${undo.id}/check-in`,
                    method: "DELETE",
                  })
                  .then(() => setUndo(null))
                  .catch(() => {});
              }}
            >
              Undo Check In
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
function Questions({ event }: { event: AdminEvent }) {
  const query = useAPI(
    "QuestionAnswers",
    `/api/admin/events/${event.id}/questions`,
  );
  if (query.isPending) return <Loading />;
  if (query.error) return <Failure error={query.error} retry={query.refetch} />;
  return query.data.questions.length ? (
    <div className="stack">
      {query.data.questions.map((q) => (
        <Panel key={q.id}>
          <h2>{q.label}</h2>
          <div className="actions">
            {Object.entries(query.data.totals[q.id] || {}).map(
              ([answer, n]) => (
                <Pill key={answer}>
                  {answer || "No answer"} · {n}
                </Pill>
              ),
            )}
          </div>
          <div className="section stack">
            {query.data.items.map((p) => (
              <div className="history-row" key={p.signup_id}>
                <strong>{p.name}</strong>
                <span>{p.answers[q.id] || "—"}</span>
              </div>
            ))}
          </div>
        </Panel>
      ))}
    </div>
  ) : (
    <Empty title="No custom questions">
      Contact and transportation information live in Signups. Add custom
      questions in the event editor.
    </Empty>
  );
}

export function Trips({
  event,
  locked,
  mpg,
}: {
  event: AdminEvent;
  locked: boolean;
  mpg?: string | number;
}) {
  const query = useAPI("Items_TripRow_", `/api/admin/events/${event.id}/trips`);
  const form = useForm({
    defaultValues: {
      miles: String(event.miles),
      gas_price: String(event.gas_price),
      rate_override:
        event.rate_override === null ? "" : String(event.rate_override),
    },
  });
  const [add, setAdd] = useState(false);
  const [person, setPerson] = useState<Person | null>(null);
  const [edit, setEdit] = useState<Schema<"TripRow"> | null>(null);
  const action = useAction();
  const rate =
    event.rate_override === null
      ? Number(event.gas_price) / Number(mpg || 25)
      : Number(event.rate_override);
  return (
    <div className="stack">
      <Panel>
        <h2>Trips & Mileage</h2>
        <p className="muted">
          Drivers receive a trip when checked in. Record final round-trip miles
          and gas price here, including after event completion.
        </p>
        <form
          onSubmit={form.handleSubmit(async (values) => {
            await action
              .mutateAsync({
                url: `/api/admin/events/${event.id}/mileage`,
                method: "PUT",
                body: {
                  ...values,
                  rate_override: values.rate_override || null,
                  expected_revision: event.revision,
                },
              })
              .catch(() => {});
          })}
        >
          <div className="form-grid">
            <Field
              label="Round-trip miles"
              type="number"
              min={0}
              step=".01"
              required
              disabled={locked}
              {...form.register("miles")}
            />
            <Field
              label="Gas price ($/gal)"
              type="number"
              min={0}
              step=".001"
              required
              disabled={locked}
              {...form.register("gas_price")}
            />
            <Field
              label="Rate override ($/mi)"
              type="number"
              min={0}
              step=".000001"
              disabled={locked}
              {...form.register("rate_override")}
              hint="Blank uses gas price ÷ quarter MPG; zero is an explicit override."
            />
          </div>
          <div className="calculation">
            {event.miles} miles × ${rate.toFixed(6)}/mile ={" "}
            <strong>{money(Number(event.miles) * rate)}</strong> per driver
            before eligibility, cap, and proration.
          </div>
          <Message error={action.error} />
          {!locked && <Button disabled={action.isPending}>Save Mileage</Button>}
        </form>
      </Panel>
      <div className="section-heading">
        <h2>Driver trips</h2>
        <Button disabled={locked} onClick={() => setAdd(true)}>
          <Plus size={16} />
          Add Trip
        </Button>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <Failure error={query.error} retry={query.refetch} />
      ) : query.data.items.length ? (
        <div className="stack">
          {query.data.items.map((t) => (
            <Panel className="record-card" key={t.id}>
              <div>
                <h3>{t.name}</h3>
                <p>
                  {money(t.cost)} ·{" "}
                  {t.source === "arrival"
                    ? "From check-in"
                    : "Manually recorded"}
                  {t.cost_override !== null && " · Override"}
                </p>
                {t.notes && <small>{t.notes}</small>}
              </div>
              <Button
                variant="secondary"
                disabled={locked}
                onClick={() => setEdit(t)}
              >
                Edit Trip
              </Button>
            </Panel>
          ))}
        </div>
      ) : (
        <Empty title="No driver trips">
          Check in drivers or add a trip manually.
        </Empty>
      )}
      {locked && (
        <Message>
          The quarter is finalized. Financial inputs are frozen.
        </Message>
      )}
      {add && (
        <PersonDialog
          title="Choose / Register Driver"
          onClose={() => setAdd(false)}
          onSelect={setPerson}
        />
      )}
      {(edit || person) && (
        <TripDialog
          event={event}
          trip={edit || undefined}
          person={person || undefined}
          onClose={() => {
            setEdit(null);
            setPerson(null);
          }}
        />
      )}
    </div>
  );
}
function TripDialog({
  event,
  trip,
  person,
  onClose,
}: {
  event: AdminEvent;
  trip?: Schema<"TripRow">;
  person?: Person;
  onClose: () => void;
}) {
  const form = useForm({
    defaultValues: {
      cost_override: trip?.cost_override || "",
      notes: trip?.notes || "",
    },
  });
  const action = useAction();
  const [remove, setRemove] = useState(false);
  return (
    <Dialog
      title={`${trip ? "Edit" : "Add"} trip · ${trip?.name || person?.name}`}
      onClose={onClose}
    >
      <form
        onSubmit={form.handleSubmit(async (values) => {
          await action
            .mutateAsync({
              url: trip
                ? `/api/admin/trips/${trip.id}`
                : `/api/admin/events/${event.id}/trips`,
              method: trip ? "PUT" : "POST",
              body: {
                ...values,
                cost_override:
                  values.cost_override === "" ? null : values.cost_override,
                ...(trip
                  ? { expected_revision: trip.revision }
                  : { member_id: person!.id }),
              },
            })
            .then(onClose)
            .catch(() => {});
        })}
      >
        <Field
          label="Cost override ($)"
          type="number"
          min={0}
          step=".01"
          {...form.register("cost_override")}
          hint="Blank uses event mileage. Enter 0 for an explicit zero-dollar trip."
        />
        <label className="field">
          Notes
          <textarea maxLength={1000} {...form.register("notes")} />
        </label>
        <Message error={action.error} />
        <div className="sticky-actions">
          <Button type="button" variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={action.isPending}>Save Trip</Button>
        </div>
        {trip && (
          <Button
            type="button"
            variant="danger"
            onClick={() => setRemove(true)}
          >
            Remove Trip
          </Button>
        )}
      </form>
      {remove && (
        <Dialog title="Remove this trip?" onClose={() => setRemove(false)}>
          <p>This will remove its cost from the current quarter estimate.</p>
          <Message error={action.error} />
          <div className="form-actions">
            <Button variant="quiet" onClick={() => setRemove(false)}>
              Keep Trip
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                void action
                  .mutateAsync({
                    url: `/api/admin/trips/${trip!.id}`,
                    method: "DELETE",
                  })
                  .then(onClose)
                  .catch(() => {});
              }}
            >
              Remove Trip
            </Button>
          </div>
        </Dialog>
      )}
    </Dialog>
  );
}
function Recap({ event }: { event: AdminEvent }) {
  const query = useAPI("RecapView", `/api/admin/events/${event.id}/recap`);
  if (query.isPending) return <Loading />;
  if (query.error) return <Failure error={query.error} retry={query.refetch} />;
  return <RecapForm key={event.id} event={event} initial={query.data} />;
}
function RecapForm({
  event,
  initial,
}: {
  event: AdminEvent;
  initial: Schema<"RecapView">;
}) {
  const form = useForm({
    defaultValues: {
      title: initial.draft.title || event.name,
      caption: initial.draft.caption || "",
      text: initial.draft.text || "",
      homepage: initial.draft.homepage || false,
    },
  });
  const [image, setImage] = useState(initial.draft.image_id || event.photo_id);
  const [revision, setRevision] = useState(initial.revision);
  const [preview, setPreview] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [saved, setSaved] = useState(false);
  const action = useAction<Schema<"RecapView">>();
  const [error, setError] = useState<Error | null>(null);
  async function save(publish = false) {
    setError(null);
    setSaved(false);
    try {
      const result = await action.mutateAsync({
        url: `/api/admin/events/${event.id}/recap`,
        method: "PUT",
        body: {
          ...form.getValues(),
          image_id: image || null,
          expected_revision: revision,
        },
      });
      setRevision(result.revision);
      if (publish) {
        const live = await request<Schema<"RecapView">>(
          `/api/admin/events/${event.id}/recap/publication`,
          "POST",
          { expected_revision: result.revision },
        );
        setRevision(live.revision);
        await action.mutateAsync({
          url: `/api/admin/events/${event.id}/recap`,
          method: "GET",
        });
        setConfirm(false);
      }
      setSaved(true);
    } catch (err) {
      setError(err as Error);
    }
  }
  return (
    <>
      <div className="split-layout">
        <Panel>
          <h2>Event recap</h2>
          <p className="muted">
            Your draft stays private until you publish it to the gallery.
            Editing a published recap keeps the existing public version until
            you publish again.
          </p>
          <form onSubmit={form.handleSubmit(() => save())}>
            <Field
              label="Polaroid title"
              required
              maxLength={150}
              {...form.register("title")}
            />
            <Field
              label="Caption"
              maxLength={300}
              {...form.register("caption")}
            />
            <label className="field">
              A little recap
              <textarea rows={5} maxLength={500} {...form.register("text")} />
              <small>{form.watch("text").length}/500 characters</small>
            </label>
            <ImageUpload purpose="event" value={image} onChange={setImage} />
            <label className="check-field">
              <input type="checkbox" {...form.register("homepage")} />
              Feature in the homepage polaroid rotation
            </label>
            <Message error={error} />
            {saved && (
              <Message>
                <Check size={16} />
                Recap saved.
              </Message>
            )}
            <div className="actions">
              <Button disabled={action.isPending}>Save Draft</Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPreview(true)}
              >
                Preview
              </Button>
              <Button
                type="button"
                disabled={action.isPending || event.state !== "completed"}
                onClick={() => {
                  void form.trigger().then((valid) => {
                    if (valid) setConfirm(true);
                  });
                }}
              >
                Publish to Gallery
              </Button>
            </div>
            {event.state !== "completed" && (
              <p className="muted">Complete the event to publish its recap.</p>
            )}
            {initial.published && (
              <Button
                type="button"
                variant="quiet"
                onClick={() => {
                  void action
                    .mutateAsync({
                      url: `/api/admin/events/${event.id}/recap/publication`,
                      method: "DELETE",
                    })
                    .catch(() => {});
                }}
              >
                Remove from Public Gallery
              </Button>
            )}
          </form>
        </Panel>
        <aside className="stack">
          <Panel>
            <h3>Attendance summary · private</h3>
            {event.completion ? (
              <div className="details-grid">
                {Object.entries(event.completion)
                  .filter(([, v]) => typeof v === "number")
                  .map(([key, value]) => (
                    <p key={key}>
                      <small>{key.replaceAll("_", " ")}</small>
                      <strong>{String(value)}</strong>
                    </p>
                  ))}
              </div>
            ) : (
              <p className="muted">
                {event.state === "completed"
                  ? "Attendance not recorded"
                  : "The completed attendance snapshot will appear here."}
              </p>
            )}
          </Panel>
          <Panel>
            <Pill>
              {initial.published
                ? "Published version available"
                : "Private draft"}
            </Pill>
            <p>
              {initial.published
                ? "Publish again to update the public polaroid."
                : "No public recap has been published yet."}
            </p>
          </Panel>
        </aside>
      </div>
      {preview && (
        <Dialog title="Recap preview" onClose={() => setPreview(false)}>
          <Polaroid
            image={photoURL(image, true)}
            title={form.getValues("title")}
            caption={form.getValues("caption")}
          />
          <p className="section">{form.getValues("text")}</p>
        </Dialog>
      )}
      {confirm && (
        <Dialog title="Publish this recap?" onClose={() => setConfirm(false)}>
          <p>
            The image, title, caption, and recap will be public. Attendance and
            private event details stay in officer tools.
          </p>
          <Message error={error} />
          <div className="form-actions">
            <Button variant="quiet" onClick={() => setConfirm(false)}>
              Keep Draft
            </Button>
            <Button
              disabled={action.isPending}
              onClick={() => {
                void save(true);
              }}
            >
              Publish Recap
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
