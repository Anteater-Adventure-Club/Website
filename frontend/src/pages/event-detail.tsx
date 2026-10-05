import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useForm } from "react-hook-form";
import {
  ArrowLeft,
  CarFront,
  Check,
  Crown,
  Minus,
  Plus,
  UsersRound,
} from "lucide-react";
import {
  clock,
  dateLabel,
  eventURL,
  photoURL,
  useAction,
  useAPI,
} from "../lib/api";
import type { Event, Schema } from "../lib/api";
import { useIdentity } from "../lib/context";
import {
  Button,
  Dialog,
  Empty,
  Failure,
  Field,
  Loading,
  Message,
  Panel,
  Pill,
  Polaroid,
} from "../components/ui";
import { VehicleDialog } from "./members";

function SignupForm({
  event,
  signup,
  hasPrioritySeating,
}: {
  event: Event;
  signup?: Schema<"SignupOwn">;
  hasPrioritySeating: boolean;
}) {
  const { session } = useIdentity();
  const cars = useAPI("Page_VehicleView_", "/api/me/vehicles");
  const [addCar, setAddCar] = useState(false);
  const form = useForm<Schema<"SignupWrite">>({
    defaultValues: {
      role: (signup?.role as Schema<"SignupWrite">["role"]) || "ride",
      vehicle_id: signup?.vehicle_id || null,
      seats: signup?.seats || 1,
      answers: signup?.answers || {},
      notes: signup?.notes || "",
      phone: session?.member?.phone || "",
      expected_revision: signup?.revision,
      request_id: crypto.randomUUID(),
    },
  });
  const action = useAction();
  const [saved, setSaved] = useState(false);
  const role = form.watch("role");
  const selectedCar = cars.data?.items.find(
    (car) => car.id === form.watch("vehicle_id"),
  );
  const offer = Number(form.watch("seats"));
  const [contact, setContact] = useState(!session?.profile_complete);
  const [cancel, setCancel] = useState(false);
  const locked =
    signup?.checked_in_at ||
    (!signup?.editable && !!signup && !signup.cancelled);
  if (signup?.checked_in_at) return <CheckedIn event={event} signup={signup} />;
  if (event.signup_status !== "open" || locked)
    return (
      <Panel className="status-card">
        <h2>
          {event.state === "completed"
            ? "Thanks for adventuring!"
            : event.state === "cancelled"
              ? "Adventure postponed"
              : event.signup_status === "not_open"
                ? "Signups open soon!"
                : "Signups are closed"}
        </h2>
        <p>
          {event.state === "cancelled"
            ? event.cancellation_reason
            : event.state === "completed"
              ? "We hope to see you on the next adventure."
              : event.opens_at && event.signup_status === "not_open"
                ? `Signups open ${dateLabel(event.opens_at)}, ${clock(event.opens_at)} Pacific time.`
                : "Catch the next event or check with an officer if you have questions."}
        </p>
        {signup && !signup.cancelled && (
          <Pill>
            Registered ·{" "}
            {signup.role === "driver"
              ? "Driving"
              : signup.role === "ride"
                ? "Needs a ride"
                : "Own ride"}
          </Pill>
        )}
        <Link className="button secondary" to="/events">
          Find Your Next Adventure
        </Link>
      </Panel>
    );
  return (
    <Panel className="signup-panel">
      <div className="section-heading">
        <h2>
          {signup && !signup.cancelled ? "You’re signed up!" : "Sign up!"}
        </h2>
      </div>
      <div className="details-grid">
        <p>
          <strong>{session?.member?.name}</strong>
          <small>{session?.member?.email}</small>
          <small>{session?.member?.phone || "Add your phone number"}</small>
        </p>
        <Button variant="quiet" onClick={() => setContact(!contact)}>
          Edit contact
        </Button>
      </div>
      <form
        onSubmit={form.handleSubmit(async (body) => {
          setSaved(false);
          const payload = {
            ...body,
            vehicle_id: body.role === "driver" ? Number(body.vehicle_id) : null,
            seats: body.role === "driver" ? Number(body.seats) : 0,
          };
          await action
            .mutateAsync({
              url: `/api/events/${event.id}/signup`,
              method: "PUT",
              body: payload,
            })
            .then(() => setSaved(true))
            .catch(() => {});
        })}
      >
        {contact && (
          <Field
            label="Phone number"
            type="tel"
            required
            maxLength={40}
            autoComplete="tel"
            {...form.register("phone")}
          />
        )}
        <fieldset>
          <legend>Ride situation</legend>
          <div className="segmented">
            {(
              [
                ["ride", "I need a ride!"],
                ["driver", "I can drive others!"],
                ["own", "I have my own ride!"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={role === value}
                onClick={() => form.setValue("role", value)}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <div
          className={`signup-membership-note${hasPrioritySeating ? " priority" : ""}`}
        >
          {hasPrioritySeating ? (
            <>
              <span className="signup-priority-icon" aria-hidden="true">
                <Crown size={21} strokeWidth={1.7} />
              </span>
              <div>
                <strong>Thanks for supporting AAC!</strong>
                <p>You have priority seating for this event.</p>
              </div>
            </>
          ) : (
            <p>
              Paid members receive priority seating. Interested?{" "}
              <Link to={`/membership?quarter=${event.quarter_id}`}>
                Become a member
              </Link>
              .
            </p>
          )}
        </div>
        {role === "driver" && (
          <>
            <label className="field">
              Which car?
              <select
                required
                {...form.register("vehicle_id", {
                  setValueAs: (value) => (value ? Number(value) : null),
                  onChange: (e) => {
                    const car = cars.data?.items.find(
                      (car) => car.id === Number(e.target.value),
                    );
                    if (car) form.setValue("seats", car.capacity);
                  },
                })}
              >
                <option value="">Choose a saved car</option>
                {cars.data?.items.map((car) => (
                  <option key={car.id} value={car.id}>
                    {[car.color, car.year, car.make, car.model]
                      .filter(Boolean)
                      .join(" ")}{" "}
                    · {car.capacity} passenger seats
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              variant="quiet"
              onClick={() => setAddCar(true)}
            >
              + Add another car
            </Button>
            <div className="field passenger-count">
              <label>Passengers you can take</label>
              <small>
                Excluding your seat · maximum{" "}
                {selectedCar?.capacity || "car capacity"}
              </small>
              <div className="counter">
                <Button
                  type="button"
                  variant="secondary"
                  aria-label="Offer one fewer seat"
                  disabled={offer <= 1}
                  onClick={() => form.setValue("seats", offer - 1)}
                >
                  <Minus size={16} />
                </Button>
                <output aria-live="polite">{offer}</output>
                <Button
                  type="button"
                  variant="secondary"
                  aria-label="Offer one more seat"
                  disabled={!selectedCar || offer >= selectedCar.capacity}
                  onClick={() => form.setValue("seats", offer + 1)}
                >
                  <Plus size={16} />
                </Button>
              </div>
            </div>
          </>
        )}
        {event.questions.map((question) => (
          <label className="field" key={question.id}>
            {question.label}
            {!question.required && <small>Optional</small>}
            {question.kind === "choice" || question.kind === "yes-no" ? (
              <select
                required={question.required}
                {...form.register(`answers.${question.id}`)}
              >
                <option value="">Choose an answer</option>
                {(question.kind === "yes-no"
                  ? ["yes", "no"]
                  : question.options || []
                ).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : question.kind === "long" ? (
              <textarea
                required={question.required}
                maxLength={2000}
                {...form.register(`answers.${question.id}`)}
              />
            ) : (
              <input
                required={question.required}
                maxLength={2000}
                {...form.register(`answers.${question.id}`)}
              />
            )}
          </label>
        ))}
        <label className="field">
          Any questions, comments, or concerns?<small>Optional</small>
          <textarea maxLength={1000} {...form.register("notes")} />
        </label>
        <Message error={action.error} />
        {saved && (
          <Message>
            <Check size={16} />
            Signup saved. See you there!
          </Message>
        )}
        <div className="sticky-actions form-actions">
          {signup && !signup.cancelled && (
            <Button
              type="button"
              variant="secondary"
              className="heading-button"
              disabled={action.isPending}
              onClick={() => setCancel(true)}
            >
              Cancel Signup
            </Button>
          )}
          <Button
            className="heading-button"
            disabled={
              action.isPending ||
              (role === "driver" &&
                (!selectedCar || offer > selectedCar.capacity))
            }
          >
            {action.isPending
              ? "Saving…"
              : signup && !signup.cancelled
                ? "Save Signup"
                : role === "driver"
                  ? "Sign up as a driver!"
                  : "Sign me up!"}
          </Button>
        </div>
      </form>
      {addCar && <VehicleDialog onClose={() => setAddCar(false)} />}
      {cancel && (
        <Dialog title="Cancel your signup?" onClose={() => setCancel(false)}>
          <p>You’ll be removed from {event.name}.</p>
          <Message error={action.error} />
          <div className="form-actions">
            <Button variant="quiet" onClick={() => setCancel(false)}>
              Keep Signup
            </Button>
            <Button
              variant="danger"
              disabled={action.isPending}
              onClick={() => {
                void action
                  .mutateAsync({
                    url: `/api/events/${event.id}/signup`,
                    method: "DELETE",
                  })
                  .then(() => setCancel(false))
                  .catch(() => {});
              }}
            >
              Cancel Signup
            </Button>
          </div>
        </Dialog>
      )}
    </Panel>
  );
}

function CheckedIn({
  event,
  signup,
}: {
  event: Event;
  signup: Schema<"SignupOwn">;
}) {
  return (
    <div className="stack">
      <Panel className="green-panel center-heading">
        <h2>You’re checked in!</h2>
        {signup.card ? (
          <>
            <small>
              {signup.card.category === "paid" ? "PAID CARD" : "GENERAL CARD"}
            </small>
            <div className={`receipt-number ${signup.card.category}`}>
              #{signup.card.number}
            </div>
          </>
        ) : (
          <p>
            {signup.role === "driver"
              ? "You’re here · driving"
              : "You’re here · own ride"}
          </p>
        )}
        <small>
          Checked in {clock(signup.checked_in_at)} at{" "}
          {event.destination || "the meeting point"}
        </small>
      </Panel>
      {signup.assigned_car ? (
        <Panel>
          <small className="muted">YOUR RIDE</small>
          <h2>{signup.assigned_car.driver_name}</h2>
          <p>
            {[
              signup.assigned_car.vehicle?.color,
              signup.assigned_car.vehicle?.year,
              signup.assigned_car.vehicle?.make,
              signup.assigned_car.vehicle?.model,
            ]
              .filter(Boolean)
              .join(" ")}
            {signup.assigned_car.vehicle?.plate &&
              ` · ${signup.assigned_car.vehicle.plate}`}
          </p>
          {signup.assigned_car.co_riders.length > 0 && (
            <p>Riding with {signup.assigned_car.co_riders.join(", ")}.</p>
          )}
          <p>Leaves {clock(event.departure_at)}</p>
        </Panel>
      ) : (
        signup.role === "ride" && (
          <Panel>
            <h3>Waiting for your ride</h3>
            <p>
              An officer will assign you to an arrived driver. Your car will
              appear here when it’s ready.
            </p>
          </Panel>
        )
      )}
      {event.packing.length > 0 && (
        <Panel>
          <h3>What to bring</h3>
          <ul className="packing-list">
            {event.packing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

export function EventDetail() {
  const { id, slug } = useParams();
  const navigate = useNavigate();
  const { session } = useIdentity();
  const event = useAPI("EventPublic", `/api/events/${id}`);
  const own = useAPI("Page_SignupOwn_", `/api/me/signups?event_id=${id}`, {
    enabled: !!session?.member,
    poll:
      !!event.data &&
      event.data.starts_at.slice(0, 10) <=
        new Date().toISOString().slice(0, 10),
  });
  const membership = useAPI(
    "MembershipView",
    `/api/me/memberships/${event.data?.quarter_id}`,
    { enabled: !!session?.member && !!event.data },
  );
  useEffect(() => {
    if (event.data && slug !== event.data.slug)
      navigate(eventURL(event.data), { replace: true });
  }, [event.data, slug, navigate]);
  if (event.isPending)
    return (
      <div className="page">
        <Loading />
      </div>
    );
  if (event.error)
    return (
      <div className="page">
        <Failure error={event.error} retry={event.refetch} />
      </div>
    );
  const e = event.data;
  const signup = own.data?.items.find((s) => s.event_id === e.id);
  return (
    <div className="page event-page">
      <Link className="text-link" to="/events">
        <ArrowLeft size={16} />
        All Events
      </Link>
      <div className="event-layout section">
        <article>
          <div className={`event-intro${e.photo_id ? "" : " without-photo"}`}>
            {e.photo_id && (
              <Polaroid
                image={photoURL(e.photo_id)}
                title={e.name}
                caption={dateLabel(e.starts_at)}
                rotation={-3}
              />
            )}
            <div>
              <div className="actions">
                <Pill tone={e.state === "cancelled" ? "orange" : "green"}>
                  {e.state === "cancelled"
                    ? "Cancelled"
                    : e.signup_status === "open"
                      ? "Signups open"
                      : e.state === "completed"
                        ? "Completed"
                        : e.signups_enabled
                          ? "Upcoming"
                          : "No signup needed"}
                </Pill>
                <span className="muted">{dateLabel(e.starts_at)}</span>
              </div>
              <h1>{e.name}</h1>
              <p className="muted">{e.destination}</p>
              {(e.state !== "completed" ||
                e.arrival_at ||
                e.departure_at ||
                e.return_at) && (
                <div className="event-schedule">
                  <div>
                    <small>Meet</small>
                    <strong>{clock(e.arrival_at || e.starts_at)}</strong>
                  </div>
                  <div>
                    <small>Leave / Start</small>
                    <strong>{clock(e.departure_at || e.starts_at)}</strong>
                  </div>
                  <div>
                    <small>Back / End</small>
                    <strong>{clock(e.return_at || e.ends_at)}</strong>
                  </div>
                </div>
              )}
              {dateLabel(e.starts_at) !== dateLabel(e.ends_at) && (
                <p>
                  {dateLabel(e.starts_at)} – {dateLabel(e.ends_at)}
                </p>
              )}
            </div>
          </div>
          {e.state === "cancelled" && (
            <div className="notice error">
              <h3>Event cancelled</h3>
              <p>{e.cancellation_reason}</p>
            </div>
          )}
          <p className="preserve-lines section">{e.description}</p>
          {e.packing.length > 0 && (
            <section className="section">
              <h3>What to bring</h3>
              <ul className="packing-list">
                {e.packing.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}
          {e.signups_enabled && e.state === "published" && (
            <section className="section event-travel">
              <h3>Getting there</h3>
              <dl className="event-signup-stats">
                <div className="event-signup-stat">
                  <dt>
                    <UsersRound size={20} aria-hidden="true" /> Signups
                  </dt>
                  <dd>
                    {e.signup_count.toLocaleString()}
                    <small>People joining us</small>
                  </dd>
                </div>
                <div className="event-signup-stat seats">
                  <dt>
                    <CarFront size={20} aria-hidden="true" /> Passenger seats
                  </dt>
                  <dd>
                    {e.offered_seats.toLocaleString()}
                    <small>Offered by drivers</small>
                  </dd>
                </div>
              </dl>
              <p className="event-arrival-note">
                Meet at {clock(e.arrival_at || e.starts_at)}. Absent rider
                reservations are released ten minutes before departure, unless
                an officer grants an extension.
              </p>
            </section>
          )}
        </article>
        <aside>
          {!e.signups_enabled ? (
            <Panel>
              <h2>Come along!</h2>
              <p>
                No signup is needed for this event. Meet us at{" "}
                {e.destination || "the event location"}.
              </p>
              <Link to="/events" className="button secondary">
                All Events
              </Link>
            </Panel>
          ) : !session?.member ? (
            <Panel>
              <h2>Come along!</h2>
              <p>
                Sign in to save your spot and arrange a ride. Use your UCI
                Google account if you have one.
              </p>
              <Link
                className="button primary heading-button"
                to={`/sign-in?return_to=${encodeURIComponent(eventURL(e))}`}
              >
                Sign in to sign up!
              </Link>
            </Panel>
          ) : own.isPending || membership.isPending ? (
            <Loading />
          ) : own.error ? (
            <Failure error={own.error} retry={own.refetch} />
          ) : membership.error ? (
            <Failure error={membership.error} retry={membership.refetch} />
          ) : e.kind === "retreat" && membership.data?.status !== "approved" ? (
            <Empty
              title="A weekend for members"
              action={
                <Link
                  className="button primary"
                  to={`/membership?quarter=${e.quarter_id}`}
                >
                  Become a Member
                </Link>
              }
            >
              Retreat signups require approved membership for this event’s
              quarter. Pending dues do not grant retreat access yet.
            </Empty>
          ) : (
            <SignupForm
              key={`${e.id}-${signup?.id || "new"}-${signup?.revision || 0}`}
              event={e}
              signup={signup}
              hasPrioritySeating={membership.data?.status === "approved"}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
