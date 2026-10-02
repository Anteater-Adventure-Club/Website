import { useState } from "react";
import { Link } from "react-router";
import { useForm } from "react-hook-form";
import { Car, Check, Plus, UserRound } from "lucide-react";
import { clock, eventURL, request, useAction, useAPI } from "../lib/api";
import type { Person, Schema } from "../lib/api";
import { Button, Dialog, Empty, Field, Message, Panel, Pill } from "./ui";

type ParticipantForm = {
  name: string;
  email: string;
  phone: string;
  student: boolean;
  role: "ride" | "driver" | "own";
  seats: number;
  vehicle_id: string;
  year: string;
  make: string;
  model: string;
  color: string;
  plate: string;
  capacity: number;
  notes: string;
  answers: Record<string, string>;
};
type RosterPerson = Schema<"SignupPrivate">;
export function carName(person: Pick<RosterPerson, "vehicle">) {
  return person.vehicle
    ? [
        person.vehicle.color,
        person.vehicle.year,
        person.vehicle.make,
        person.vehicle.model,
      ]
        .filter(Boolean)
        .join(" ")
    : "Car details unavailable";
}
export function roleName(role: string) {
  return role === "ride" ? "Rider" : role === "driver" ? "Driver" : "Own Ride";
}

export function CarpoolView({
  data,
  tap = false,
  locked = false,
}: {
  data: Schema<"CheckInView">;
  tap?: boolean;
  locked?: boolean;
}) {
  const drivers = data.signups.filter(
    (s) => s.role === "driver" && s.checked_in_at,
  );
  const riders = data.signups.filter(
    (s) => s.role === "ride" && s.checked_in_at,
  );
  const waiting = riders.filter((s) => !s.driver_signup_id);
  const [selected, setSelected] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const selectedDriver =
    drivers.find((s) => s.id === selected) ||
    drivers.find(
      (d) => riders.filter((r) => r.driver_signup_id === d.id).length < d.seats,
    ) ||
    drivers[0];
  const action = useAction<{ filled?: number }>();
  const base = `/api/admin/events/${data.event.id}/carpools`;
  const seats = (driver: RosterPerson) =>
    riders.filter((s) => s.driver_signup_id === driver.id);
  async function assign(rider: RosterPerson, driver: RosterPerson | null) {
    setMessage("");
    await action
      .mutateAsync({
        url: `${base}/${rider.id}`,
        method: "PUT",
        body: {
          driver_signup_id: driver?.id || null,
          expected_revision: data.revision,
        },
      })
      .catch(() => {});
  }
  return (
    <div className="stack">
      <div className="toolbar">
        <div>
          <h2>{tap ? "Tap to seat" : "Carpools"}</h2>
          <p className="muted">
            {waiting.length} waiting ·{" "}
            {drivers.reduce((n, d) => n + d.seats, 0) -
              (riders.length - waiting.length)}{" "}
            open seats · {drivers.length} arrived cars
          </p>
        </div>
        <div className="actions">
          {!tap && (
            <Link
              className="button secondary"
              to={`${eventURL(data.event, true)}/seat`}
            >
              Tap to Seat
            </Link>
          )}
          <Button
            disabled={locked || action.isPending || !waiting.length}
            onClick={() => {
              void action
                .mutateAsync({
                  url: `${base}/fill`,
                  body: { expected_revision: data.revision },
                })
                .then((r) =>
                  setMessage(
                    `${r.filled || 0} riders seated. Existing assignments kept.`,
                  ),
                )
                .catch(() => {});
            }}
          >
            Fill the Rest
          </Button>
        </div>
      </div>
      <Message error={action.error}>{message}</Message>
      {!drivers.length ? (
        <Empty title="Waiting for drivers">
          Cars appear here after their drivers check in. Riders can check in
          while waiting.
        </Empty>
      ) : (
        <>
          <div className="car-grid">
            {drivers.map((driver) => (
              <Panel
                key={driver.id}
                className={`car-card ${tap && driver.id === selectedDriver?.id ? "selected" : ""}`}
              >
                <div className="section-heading">
                  <h3>
                    <Car size={20} />
                    {driver.name}
                  </h3>
                  <Pill
                    tone={
                      seats(driver).length === driver.seats ? "solid" : "green"
                    }
                  >
                    {seats(driver).length}/{driver.seats}
                  </Pill>
                </div>
                <p>{carName(driver)}</p>
                <small className="muted">
                  {driver.vehicle?.plate || "No plate saved"} · Arrived{" "}
                  {clock(driver.checked_in_at)}
                </small>
                {tap && (
                  <Button
                    variant="secondary"
                    className="section"
                    aria-pressed={driver.id === selectedDriver?.id}
                    onClick={() => setSelected(driver.id)}
                  >
                    Select Car
                  </Button>
                )}
                <div className="seat-grid">
                  {Array.from({ length: driver.seats }, (_, i) => {
                    const rider = seats(driver)[i];
                    return (
                      <button
                        type="button"
                        className={`seat ${rider ? "occupied" : ""}`}
                        key={i}
                        aria-label={
                          rider
                            ? `Unseat ${rider.name}`
                            : `Empty seat ${i + 1} in ${driver.name}’s car`
                        }
                        disabled={locked || action.isPending || !rider}
                        onClick={() => rider && void assign(rider, null)}
                      >
                        {rider ? (
                          <>
                            <UserRound size={18} />
                            {rider.name}
                            <small>
                              {rider.card?.category} #{rider.card?.number}
                            </small>
                          </>
                        ) : (
                          <>
                            <Plus size={18} />
                            Empty
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
                {seats(driver).length === driver.seats && (
                  <small className="ready">
                    <Check size={16} />
                    Ready to go
                  </small>
                )}
              </Panel>
            ))}
          </div>
          <Panel>
            <h3>
              {tap && selectedDriver
                ? `Waiting riders · tap to seat in ${selectedDriver.name}’s car`
                : "Waiting riders"}
            </h3>
            {!waiting.length ? (
              <p className="muted">Everyone who has arrived is seated.</p>
            ) : (
              <div className="waiting-riders">
                {waiting.map((rider) => (
                  <div key={rider.id} className="waiting-chip">
                    <span>
                      <strong>{rider.name}</strong>
                      <small>
                        {rider.card?.category} #{rider.card?.number}
                      </small>
                    </span>
                    {tap ? (
                      <Button
                        disabled={
                          locked ||
                          action.isPending ||
                          !selectedDriver ||
                          seats(selectedDriver).length >= selectedDriver.seats
                        }
                        onClick={() => {
                          if (selectedDriver)
                            void assign(rider, selectedDriver);
                        }}
                      >
                        Seat
                      </Button>
                    ) : (
                      <select
                        aria-label={`Assign ${rider.name} to a car`}
                        value=""
                        disabled={locked || action.isPending}
                        onChange={(e) => {
                          const driver = drivers.find(
                            (d) => d.id === Number(e.target.value),
                          );
                          if (driver) void assign(rider, driver);
                        }}
                      >
                        <option value="">Choose car</option>
                        {drivers.map((driver) => (
                          <option
                            key={driver.id}
                            value={driver.id}
                            disabled={seats(driver).length >= driver.seats}
                          >
                            {driver.name} ·{" "}
                            {driver.seats - seats(driver).length} open
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

export function AddParticipantDialog({
  event,
  walkIn,
  onClose,
  onReceipt,
}: {
  event: Schema<"EventPrivate">;
  walkIn?: boolean;
  onClose: () => void;
  onReceipt?: (person: RosterPerson) => void;
}) {
  const [selected, setSelected] = useState<Person | null>(null);
  const [search, setSearch] = useState("");
  const [manual, setManual] = useState(false);
  const [lookup, setLookup] = useState("");
  const [requestId] = useState(crypto.randomUUID());
  const members = useAPI(
    "MemberList",
    `/api/admin/members?limit=10&search=${encodeURIComponent(search)}`,
    { enabled: search.length > 1 && !manual },
  );
  const cars = useAPI(
    "Page_VehicleView_",
    `/api/admin/members/${selected?.id}/vehicles`,
    { enabled: !!selected },
  );
  const form = useForm<ParticipantForm>({
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      student: true,
      role: "ride",
      seats: 3,
      vehicle_id: "new",
      year: String(new Date().getFullYear()),
      make: "",
      model: "",
      color: "",
      plate: "",
      capacity: 4,
      notes: "",
      answers: {},
    },
  });
  const role = form.watch("role");
  const vehicleId = form.watch("vehicle_id");
  const action = useAction<RosterPerson>();
  const [error, setError] = useState<Error | null>(null);
  async function save(fields: ParticipantForm) {
    const member = {
      name: fields.name,
      email: fields.email || null,
      phone: fields.phone,
      student: fields.student,
    };
    const vehicle =
      role === "driver" && vehicleId === "new"
        ? {
            year: Number(fields.year),
            make: fields.make,
            model: fields.model,
            color: fields.color,
            plate: fields.plate,
            capacity: Number(fields.capacity),
          }
        : null;
    const signup = {
      role,
      seats: role === "driver" ? Number(fields.seats) : 0,
      vehicle_id:
        role === "driver" && vehicleId !== "new" ? Number(vehicleId) : null,
      answers: fields.answers,
      notes: fields.notes,
      phone: fields.phone || null,
    };
    setError(null);
    try {
      if (walkIn) {
        await action
          .mutateAsync({
            url: `/api/admin/events/${event.id}/walk-ins`,
            body: {
              member_id: selected?.id || null,
              member: selected ? null : member,
              vehicle,
              signup,
              request_id: requestId,
            },
          })
          .then((result) => {
            onReceipt?.(result);
            onClose();
          });
      } else {
        const person =
          selected ||
          (await request<Person>("/api/admin/members", "POST", member));
        if (vehicle) {
          const car = await request<Schema<"VehicleView">>(
            `/api/admin/members/${person.id}/vehicles`,
            "POST",
            vehicle,
          );
          signup.vehicle_id = car.id;
        }
        await action
          .mutateAsync({
            url: `/api/admin/events/${event.id}/signups`,
            body: { ...signup, member_id: person.id },
          })
          .then(onClose);
      }
    } catch (err) {
      setError(err as Error);
    }
  }
  return (
    <Dialog
      title={walkIn ? "Add & Check In a Walk-in" : "Add participant"}
      onClose={onClose}
    >
      <form onSubmit={form.handleSubmit(save)}>
        {!selected && !manual ? (
          <>
            <Field
              label="Find a member"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or email"
              autoComplete="off"
            />
            {members.data?.items.map(({ member }) => (
              <button
                type="button"
                className="member-option"
                key={member.id}
                onClick={() => {
                  setSelected(member);
                  form.setValue("phone", member.phone);
                  form.setValue("name", member.name);
                  form.setValue("email", member.email || "");
                }}
              >
                <strong>{member.name}</strong>
                <small>{member.email || "No email saved"}</small>
              </button>
            ))}
            <Button
              type="button"
              variant="secondary"
              onClick={() => setManual(true)}
            >
              Enter a New Person
            </Button>
          </>
        ) : (
          <>
            <div className="section-heading">
              <h3>{selected?.name || "New person"}</h3>
              <Button
                type="button"
                variant="quiet"
                onClick={() => {
                  setSelected(null);
                  setManual(false);
                }}
              >
                Change Person
              </Button>
            </div>
            {manual && (
              <>
                <Field label="Email" type="email" {...form.register("email")} />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={async () => {
                    setLookup("Looking up…");
                    try {
                      const result = await request<{ name: string | null }>(
                        `/api/admin/directory?email=${encodeURIComponent(form.getValues("email"))}`,
                      );
                      if (result.name) form.setValue("name", result.name);
                      setLookup(
                        result.name
                          ? "Name filled in."
                          : "Enter the name manually.",
                      );
                    } catch {
                      setLookup(
                        "Directory unavailable. Enter the name manually.",
                      );
                    }
                  }}
                >
                  UCI Directory Lookup
                </Button>
                {lookup && <Message>{lookup}</Message>}
                <Field
                  label="Name"
                  required
                  maxLength={100}
                  {...form.register("name")}
                />
                <label className="check-field">
                  <input type="checkbox" {...form.register("student")} />
                  UCI student
                </label>
              </>
            )}
            <Field
              label="Phone"
              type="tel"
              maxLength={40}
              {...form.register("phone")}
            />
            <fieldset>
              <legend>Ride situation</legend>
              <div className="segmented">
                {(["ride", "driver", "own"] as const).map((value) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={role === value}
                    onClick={() => form.setValue("role", value)}
                  >
                    {roleName(value)}
                  </button>
                ))}
              </div>
            </fieldset>
            {role === "driver" && (
              <>
                <label className="field">
                  Vehicle
                  <select {...form.register("vehicle_id")}>
                    <option value="new">Add car details</option>
                    {cars.data?.items.map((car) => (
                      <option value={car.id} key={car.id}>
                        {car.color} {car.year} {car.make} {car.model}
                      </option>
                    ))}
                  </select>
                </label>
                {vehicleId === "new" && (
                  <div className="form-grid">
                    <Field
                      label="Year"
                      type="number"
                      min={1900}
                      max={new Date().getFullYear() + 2}
                      required
                      {...form.register("year")}
                    />
                    <Field
                      label="Make"
                      required
                      maxLength={80}
                      {...form.register("make")}
                    />
                    <Field
                      label="Model"
                      required
                      maxLength={80}
                      {...form.register("model")}
                    />
                    <Field
                      label="Color"
                      required
                      maxLength={80}
                      {...form.register("color")}
                    />
                    <Field
                      label="License plate"
                      maxLength={30}
                      {...form.register("plate")}
                    />
                    <Field
                      label="Passenger capacity · excludes driver"
                      type="number"
                      min={1}
                      max={50}
                      required
                      {...form.register("capacity")}
                    />
                  </div>
                )}
                <Field
                  label="Seats offered · excludes driver"
                  type="number"
                  min={1}
                  max={50}
                  required
                  {...form.register("seats")}
                />
              </>
            )}
            {event.questions.map((q) => (
              <label className="field" key={q.id}>
                {q.label}
                {q.kind === "choice" || q.kind === "yes-no" ? (
                  <select
                    required={q.required}
                    {...form.register(`answers.${q.id}`)}
                  >
                    <option value="">Choose an answer</option>
                    {(q.kind === "yes-no"
                      ? ["yes", "no"]
                      : q.options || []
                    ).map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                ) : (
                  <textarea
                    required={q.required}
                    maxLength={2000}
                    {...form.register(`answers.${q.id}`)}
                  />
                )}
              </label>
            ))}
            <label className="field">
              Notes
              <textarea maxLength={1000} {...form.register("notes")} />
            </label>
            {walkIn && (
              <Message>
                Registration, ride details, and check-in save together. The
                confirmed receipt shows the actual card number.
              </Message>
            )}
            <Message error={error || action.error} />
            <div className="sticky-actions">
              <Button type="button" variant="quiet" onClick={onClose}>
                Cancel
              </Button>
              <Button disabled={action.isPending}>
                {walkIn ? "Add & Check In" : "Add Participant"}
              </Button>
            </div>
          </>
        )}
      </form>
    </Dialog>
  );
}
