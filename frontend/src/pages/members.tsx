import { useState } from "react";
import { Link } from "react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Car, Check, Plus } from "lucide-react";
import { dateLabel, eventURL, money, useAction, useAPI } from "../lib/api";
import type { Person, Schema } from "../lib/api";
import { quarterURL, useIdentity, useQuarter } from "../lib/context";
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
            {benefits.data?.quarter ? (
              <p>
                {money(benefits.data.budget)} is available in{" "}
                {benefits.data.quarter.name}, currently covering{" "}
                {(Number(benefits.data.coverage) * 100).toFixed(0)}% of eligible
                capped driving costs.
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

const profileSchema = z.object({
  name: z.string().trim().min(1, "Your name is required").max(100),
  phone: z.string().max(40),
  pronouns: z.string().max(60),
  discord: z.string().max(100),
  student: z.boolean(),
  can_drive: z.boolean().nullable(),
  driving_preferences: z.string().max(500),
});

function ProfileForm({ profile }: { profile: Person }) {
  const form = useForm<z.infer<typeof profileSchema>>({
    defaultValues: {
      name: profile.name,
      phone: profile.phone,
      pronouns: profile.pronouns,
      discord: profile.discord,
      student: profile.student,
      can_drive: profile.can_drive,
      driving_preferences: profile.driving_preferences,
    },
    resolver: zodResolver(profileSchema),
  });
  const action = useAction();
  const [saved, setSaved] = useState(false);
  return (
    <Panel>
      <h3>About you</h3>
      <form
        onSubmit={form.handleSubmit(async (body) => {
          setSaved(false);
          await action
            .mutateAsync({ url: "/api/me/profile", method: "PUT", body })
            .then(() => setSaved(true))
            .catch(() => {});
        })}
      >
        <div className="form-grid">
          <Field
            label="Full name"
            autoComplete="name"
            required
            maxLength={100}
            {...form.register("name")}
          />
          <Field
            label="Phone number"
            type="tel"
            autoComplete="tel"
            maxLength={40}
            {...form.register("phone")}
          />
          <Field
            label="Email"
            value={profile.email || ""}
            readOnly
            hint="Your verified Google email identifies your account."
          />
          <Field
            label="Discord handle"
            maxLength={100}
            hint="Optional"
            {...form.register("discord")}
          />
          <Field
            label="Pronouns"
            maxLength={60}
            {...form.register("pronouns")}
          />
          <label className="field">
            Membership category
            <select
              {...form.register("student", {
                setValueAs: (value) => value === "true" || value === true,
              })}
            >
              <option value="true">UCI student</option>
              <option value="false">Non-student</option>
            </select>
          </label>
        </div>
        <fieldset>
          <legend>In general, are you able to offer rides to events?</legend>
          <div className="segmented">
            {(
              [
                [true, "Yes"],
                [false, "No"],
                [null, "Maybe"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={label}
                type="button"
                aria-pressed={form.watch("can_drive") === value}
                onClick={() => form.setValue("can_drive", value)}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="field">
          Driving preferences
          <textarea
            maxLength={500}
            {...form.register("driving_preferences")}
            placeholder="Anything you’d like officers to know?"
          />
        </label>
        {Object.values(form.formState.errors).map((error, i) => (
          <Message key={i}>{error.message}</Message>
        ))}
        <Message error={action.error} />
        {saved && (
          <Message>
            <Check size={16} /> Profile saved.
          </Message>
        )}
        <div>
          <Button disabled={action.isPending}>Save Profile</Button>
        </div>
      </form>
    </Panel>
  );
}

function PayoutForm({ profile }: { profile: Person }) {
  const form = useForm<Schema<"PayoutDetailsWrite">>({
    defaultValues: {
      payout_method:
        profile.payout_method as Schema<"PayoutDetailsWrite">["payout_method"],
      payout_destination: profile.payout_destination,
      payout_phone_suffix: profile.payout_phone_suffix,
    },
  });
  const action = useAction();
  return (
    <Panel>
      <h3>Ride reimbursement details</h3>
      <p className="muted">
        These details are private to you and AAC officers.
      </p>
      <form
        onSubmit={form.handleSubmit(async (body) => {
          await action
            .mutateAsync({ url: "/api/me/payout-details", method: "PUT", body })
            .catch(() => {});
        })}
      >
        <label className="field">
          Where should we send your reimbursement?
          <select {...form.register("payout_method")}>
            <option value="">Prefer not to say yet</option>
            <option value="venmo">Venmo</option>
            <option value="zelle">Zelle</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
          </select>
        </label>
        <div className="form-grid">
          <Field
            label="Username, email or phone"
            maxLength={200}
            {...form.register("payout_destination")}
          />
          <Field
            label="Last four phone digits"
            inputMode="numeric"
            pattern="[0-9]{4}|^$"
            maxLength={4}
            hint="Optional verification for Venmo"
            {...form.register("payout_phone_suffix")}
          />
        </div>
        <Message error={action.error} />
        {action.isSuccess && <Message>Reimbursement details saved.</Message>}
        <div>
          <Button disabled={action.isPending}>
            Save Reimbursement Details
          </Button>
        </div>
      </form>
    </Panel>
  );
}

export function VehicleDialog({
  vehicle,
  onClose,
}: {
  vehicle?: Schema<"VehicleView">;
  onClose: () => void;
}) {
  const form = useForm<Schema<"VehicleWrite">>({
    defaultValues: vehicle
      ? {
          year: vehicle.year || new Date().getFullYear(),
          make: vehicle.make,
          model: vehicle.model,
          color: vehicle.color,
          plate: vehicle.plate,
          capacity: vehicle.capacity,
        }
      : {
          year: new Date().getFullYear(),
          make: "",
          model: "",
          color: "",
          plate: "",
          capacity: 4,
        },
  });
  const action = useAction();
  return (
    <Dialog title={vehicle ? "Edit your car" : "Add a car"} onClose={onClose}>
      <form
        onSubmit={form.handleSubmit(async (body) => {
          await action
            .mutateAsync({
              url: `/api/me/vehicles${vehicle ? `/${vehicle.id}` : ""}`,
              method: vehicle ? "PUT" : "POST",
              body,
            })
            .then(onClose)
            .catch(() => {});
        })}
      >
        <div className="form-grid">
          <Field
            label="Year"
            type="number"
            min={1900}
            max={2100}
            required
            {...form.register("year", { valueAsNumber: true })}
          />
          <Field
            label="Make"
            maxLength={60}
            required
            {...form.register("make")}
          />
          <Field
            label="Model"
            maxLength={60}
            required
            {...form.register("model")}
          />
          <Field label="Color" maxLength={40} {...form.register("color")} />
          <Field
            label="License plate"
            maxLength={20}
            {...form.register("plate")}
          />
          <Field
            label="Passenger seats"
            type="number"
            min={1}
            max={50}
            required
            hint="Excluding the driver"
            {...form.register("capacity", { valueAsNumber: true })}
          />
        </div>
        <Message error={action.error} />
        <div className="sticky-actions">
          <Button type="button" variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={action.isPending}>Save Car</Button>
        </div>
      </form>
    </Dialog>
  );
}

export function Profile() {
  const profile = useAPI("MemberPrivate", "/api/me/profile");
  const vehicles = useAPI("Page_VehicleView_", "/api/me/vehicles");
  const [car, setCar] = useState<Schema<"VehicleView"> | "new" | null>(null);
  const [remove, setRemove] = useState<Schema<"VehicleView"> | null>(null);
  const action = useAction();
  if (profile.isPending) return <Loading />;
  if (profile.error)
    return <Failure error={profile.error} retry={profile.refetch} />;
  return (
    <>
      <PageHeading
        title="Profile"
        subtitle="Set up once, adventure often. Your details fill in every event signup."
      />
      <div className="split-layout">
        <div className="stack">
          <ProfileForm profile={profile.data} />
          <PayoutForm profile={profile.data} />
        </div>
        <section>
          <div className="section-heading">
            <h3>Your cars</h3>
            <Button variant="secondary" onClick={() => setCar("new")}>
              <Plus size={16} /> Add a car
            </Button>
          </div>
          {vehicles.data?.items.length ? (
            <div className="stack">
              {vehicles.data.items.map((v) => (
                <Panel key={v.id}>
                  <h3>
                    {[v.color, v.year, v.make, v.model]
                      .filter(Boolean)
                      .join(" ")}
                  </h3>
                  <p className="muted">
                    {v.plate || "No plate saved"} · {v.capacity} passenger seats
                  </p>
                  <div className="actions">
                    <Button variant="quiet" onClick={() => setCar(v)}>
                      Edit
                    </Button>
                    <Button variant="quiet" onClick={() => setRemove(v)}>
                      Remove
                    </Button>
                  </div>
                </Panel>
              ))}
            </div>
          ) : (
            <Empty
              title="Room for adventure"
              action={
                <Button onClick={() => setCar("new")}>
                  <Car size={18} />
                  Add your first car
                </Button>
              }
            >
              Save a car if you’d like to offer rides. Passenger capacity
              excludes your seat.
            </Empty>
          )}
        </section>
      </div>
      {car && (
        <VehicleDialog
          vehicle={car === "new" ? undefined : car}
          onClose={() => setCar(null)}
        />
      )}
      {remove && (
        <Dialog title="Remove this car?" onClose={() => setRemove(null)}>
          <p>
            This removes it from future choices. Existing event signups keep
            their saved car details.
          </p>
          <Message error={action.error} />
          <div className="form-actions">
            <Button variant="quiet" onClick={() => setRemove(null)}>
              Keep Car
            </Button>
            <Button
              variant="danger"
              disabled={action.isPending}
              onClick={() => {
                void action
                  .mutateAsync({
                    url: `/api/me/vehicles/${remove.id}`,
                    method: "DELETE",
                  })
                  .then(() => setRemove(null))
                  .catch(() => {});
              }}
            >
              Remove Car
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}

export function MyOverview() {
  const { quarter } = useQuarter();
  const { session } = useIdentity();
  const query = useAPI(
    "MyOverview",
    `/api/me/overview${quarter ? `?quarter_id=${quarter.id}` : ""}`,
  );
  if (query.isPending) return <Loading />;
  if (query.error) return <Failure error={query.error} retry={query.refetch} />;
  return (
    <>
      <PageHeading
        title={`Hi, ${session?.member?.name.split(" ")[0] || "adventurer"}!`}
        subtitle="Your next adventure starts here!"
      />
      <div className="split-layout">
        <Panel>
          {query.data.next_event ? (
            <>
              <small className="muted">NEXT ADVENTURE</small>
              <h2>{query.data.next_event.name}</h2>
              <p>
                {dateLabel(query.data.next_event.starts_at)} ·{" "}
                {query.data.next_event.destination}
              </p>
              <p className="preserve-lines">
                {query.data.next_event.description.slice(0, 220)}
              </p>
              <div className="actions">
                <Link
                  className="button primary"
                  to={eventURL(query.data.next_event)}
                >
                  View / Sign Up
                </Link>
                <Link className="button secondary" to="/events">
                  All Events
                </Link>
              </div>
            </>
          ) : (
            <Empty
              title="More adventures ahead"
              action={
                <Link to="/events" className="button secondary">
                  Explore Events
                </Link>
              }
            >
              Our next event will appear here when it’s published.
            </Empty>
          )}
        </Panel>
        <Panel>
          <small className="muted">YOUR MEMBERSHIP</small>
          <h2>{quarter?.name || "General Member"}</h2>
          <Pill
            tone={
              query.data.membership?.status === "approved" ? "solid" : "green"
            }
          >
            {query.data.membership?.status === "approved"
              ? "Paid Member"
              : query.data.membership?.status === "pending"
                ? "Pending Confirmation"
                : "General Member"}
          </Pill>
          <p className="section">
            Weekly activities are free. Paid membership adds priority carpool
            seats and quarterly retreats.
          </p>
          <Link
            className="button primary"
            to={quarterURL("/membership", quarter?.id)}
          >
            {query.data.membership?.status === "approved"
              ? "View Membership"
              : "Become a Member"}
          </Link>
        </Panel>
      </div>
      <section className="section">
        <div className="section-heading">
          <h2>Your signups</h2>
          <Link to={quarterURL("/my-aac/signups", quarter?.id)}>
            All Signups →
          </Link>
        </div>
        {query.data.signups.length ? (
          <div className="card-grid">
            {query.data.signups
              .filter((s) => s.event)
              .slice(0, 3)
              .map((s) => (
                <EventCard key={s.id} event={s.event!} />
              ))}
          </div>
        ) : (
          <Empty
            title="Your next adventure is waiting"
            action={
              <Link className="button primary" to="/events">
                Find an Event
              </Link>
            }
          >
            You haven’t signed up for an upcoming event yet.
          </Empty>
        )}
      </section>
    </>
  );
}

export function MySignups() {
  const { quarter } = useQuarter();
  const query = useAPI(
    "Page_SignupOwn_",
    `/api/me/signups?limit=200${quarter ? `&quarter_id=${quarter.id}` : ""}`,
  );
  const action = useAction();
  const [cancel, setCancel] = useState<Schema<"SignupOwn"> | null>(null);
  if (query.isPending) return <Loading />;
  if (query.error) return <Failure error={query.error} retry={query.refetch} />;
  return (
    <>
      <PageHeading
        title="My signups"
        subtitle={`Your adventures${quarter ? ` for ${quarter.name}` : ""}.`}
      />
      {query.data.items.length ? (
        <div className="stack">
          {query.data.items
            .filter((s) => s.event)
            .map((s) => (
              <Panel key={s.id} className="record-card">
                <div>
                  <Pill
                    tone={
                      s.cancelled || s.event!.state === "cancelled"
                        ? "orange"
                        : s.checked_in_at
                          ? "solid"
                          : "green"
                    }
                  >
                    {s.cancelled || s.event!.state === "cancelled"
                      ? "Cancelled"
                      : s.event!.state === "completed"
                        ? s.checked_in_at
                          ? "Attended"
                          : "Missed"
                        : s.checked_in_at
                          ? "Checked In"
                          : "Signed Up"}
                  </Pill>
                  <h3>{s.event!.name}</h3>
                  <p>
                    {dateLabel(s.event!.starts_at)} · {s.event!.destination}
                  </p>
                  <p>
                    {s.role === "driver"
                      ? `Driving · ${s.seats} passenger seats · ${s.vehicle?.make} ${s.vehicle?.model}`
                      : s.role === "ride"
                        ? "Needs a ride"
                        : "Has own ride"}
                  </p>
                  {s.card && (
                    <p>
                      {s.card.category === "paid" ? "Paid" : "General"} card #
                      {s.card.number}
                    </p>
                  )}
                </div>
                <div className="actions">
                  <Link className="button primary" to={eventURL(s.event!)}>
                    {s.editable && !s.cancelled
                      ? "View / Edit Signup"
                      : "View Event"}
                  </Link>
                  {s.editable && !s.cancelled && (
                    <Button variant="quiet" onClick={() => setCancel(s)}>
                      Cancel
                    </Button>
                  )}
                </div>
              </Panel>
            ))}
        </div>
      ) : (
        <Empty
          title="No signups yet"
          action={
            <Link className="button primary" to="/events">
              Explore Events
            </Link>
          }
        >
          Your event signups will appear here.
        </Empty>
      )}
      {cancel && (
        <Dialog title="Cancel your signup?" onClose={() => setCancel(null)}>
          <p>You’ll be removed from {cancel.event?.name}.</p>
          <Message error={action.error} />
          <div className="form-actions">
            <Button variant="quiet" onClick={() => setCancel(null)}>
              Keep Signup
            </Button>
            <Button
              variant="danger"
              disabled={action.isPending}
              onClick={() => {
                void action
                  .mutateAsync({
                    url: `/api/events/${cancel.event_id}/signup`,
                    method: "DELETE",
                  })
                  .then(() => setCancel(null))
                  .catch(() => {});
              }}
            >
              Cancel Signup
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}

export function MyReimbursements() {
  const { quarter } = useQuarter();
  const query = useAPI(
    "MyReimbursements",
    `/api/me/reimbursements${quarter ? `?quarter_id=${quarter.id}` : ""}`,
  );
  if (query.isPending) return <Loading />;
  if (query.error) return <Failure error={query.error} retry={query.refetch} />;
  const row = query.data.driver;
  return (
    <>
      <PageHeading
        title="My reimbursements"
        subtitle={`${query.data.quarter?.name || "Your driving history"} · Driving together makes more adventures possible.`}
      />
      {row ? (
        <div className="split-layout">
          <div className="stack">
            <Panel className="green-panel center-heading">
              <small>
                {query.data.quarter?.state === "open"
                  ? "ESTIMATED REIMBURSEMENT"
                  : row.paid_on
                    ? "PAID REIMBURSEMENT"
                    : "FINALIZED REIMBURSEMENT"}
              </small>
              <div className="large-amount">{money(row.allocated)}</div>
              <p>
                {query.data.quarter?.state === "open"
                  ? "Not final. This can change until officers finalize the quarter."
                  : row.paid_on
                    ? `Paid ${dateLabel(row.paid_on)} · ${row.reference}`
                    : "Your payout is frozen and waiting to be paid."}
              </p>
            </Panel>
            <Panel>
              <h3>How it’s calculated</h3>
              <dl className="calculation-list">
                <div>
                  <dt>Your trip costs</dt>
                  <dd>{money(row.nominal)}</dd>
                </div>
                <div>
                  <dt>Eligible costs</dt>
                  <dd>{money(row.eligible_cost)}</dd>
                </div>
                <div>
                  <dt>
                    After driver cap
                    {Number(query.data.driver_cap)
                      ? ` (${money(query.data.driver_cap)})`
                      : " (no cap)"}
                  </dt>
                  <dd>{money(row.capped)}</dd>
                </div>
                <div>
                  <dt>Budget coverage</dt>
                  <dd>{(Number(query.data.coverage) * 100).toFixed(2)}%</dd>
                </div>
                <div>
                  <dt>
                    {query.data.quarter?.state === "open"
                      ? "Estimate"
                      : "Payout"}
                  </dt>
                  <dd>{money(row.allocated)}</dd>
                </div>
              </dl>
              <p className="muted">
                Eligible costs are capped, then shared proportionally within the
                club budget. Remaining cents are distributed consistently.
              </p>
              {!row.eligible && (
                <Message>
                  These trips are not currently eligible for reimbursement.
                  Approved membership usually grants eligibility; an officer can
                  review exceptions.
                </Message>
              )}
              <Link className="text-link" to="/my-aac/profile">
                Edit your private payout details →
              </Link>
            </Panel>
          </div>
          <section>
            <h2>Your trips · {row.trips.length}</h2>
            <div className="stack">
              {row.trips.map((t) => (
                <Panel key={t.id} className="record-card">
                  <div>
                    <h3>{t.event_name}</h3>
                    <p>
                      {dateLabel(t.starts_at)} · {t.miles} mi
                      {t.notes && ` · ${t.notes}`}
                    </p>
                  </div>
                  <strong>{money(t.cost)}</strong>
                </Panel>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <Empty
          title="Ready to drive?"
          action={
            <Link className="button primary" to="/events">
              Explore Events
            </Link>
          }
        >
          Your recorded driver trips and reimbursement estimates will appear
          here.
        </Empty>
      )}
    </>
  );
}
