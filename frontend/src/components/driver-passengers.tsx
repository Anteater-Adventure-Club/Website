import type { Signup } from "../lib/api";

export function isLiveDriverSignup(signup: Signup) {
  return (
    signup.role === "driver" &&
    !signup.cancelled &&
    !!signup.checked_in_at &&
    signup.event?.state === "published"
  );
}

export function DriverPassengers({
  signup,
  compact = false,
}: {
  signup: Signup;
  compact?: boolean;
}) {
  if (signup.role !== "driver" || !signup.checked_in_at || signup.cancelled)
    return null;
  // Older API containers still supply first names during a rolling deployment.
  const passengers =
    signup.assigned_car?.passengers ??
    signup.assigned_car?.co_riders.map((name, index) => ({
      signup_id: index,
      name,
    })) ??
    [];
  const title = `Your passengers (${passengers.length})`;
  return (
    <section className="driver-passengers" aria-label="Your passengers">
      {compact ? <strong>{title}</strong> : <h3>{title}</h3>}
      {passengers.length ? (
        <ul className="passenger-roster">
          {passengers.map((passenger) => (
            <li key={passenger.signup_id}>{passenger.name}</li>
          ))}
        </ul>
      ) : (
        <p>
          No passengers assigned yet.
          {!compact && " An officer will assign passengers to your car."}
        </p>
      )}
    </section>
  );
}
