import { useState } from "react";
import {
  clock,
  dateLabel,
  fromPacific,
  request,
  useAction,
  useAPI,
} from "../lib/api";
import type { Person, Schema } from "../lib/api";
import { useQuarter } from "../lib/context";
import { useSearchQuery } from "../lib/search-query";
import {
  Button,
  Dialog,
  Empty,
  Failure,
  Field,
  Loading,
  Message,
  Pill,
} from "./ui";
import { eventKindLabels, restrictionScope } from "./restrictions";

export function MemberBanForm({
  person,
  onClose,
}: {
  person: Person;
  onClose: () => void;
}) {
  const { quarter, quarters } = useQuarter();
  const [allEvents, setAllEvents] = useState(false);
  const [kinds, setKinds] = useState<string[]>([]);
  const [events, setEvents] = useState<Schema<"BanEvent">[]>([]);
  const [membership, setMembership] = useState(false);
  const [permanent, setPermanent] = useState(false);
  const [expires, setExpires] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [qid, setQid] = useState(String(quarter?.id || quarters[0]?.id || ""));
  const [search, setSearch] = useState("");
  const { query: searchQuery } = useSearchQuery(search);
  const [offset, setOffset] = useState(0);
  const choices = useAPI(
    "Page_EventPrivate_",
    `/api/admin/events?quarter_id=${qid}&state=published&limit=50&offset=${offset}&search=${encodeURIComponent(searchQuery)}`,
    { enabled: !allEvents && !!qid },
  );
  const [requestId] = useState(() => crypto.randomUUID());
  const [review, setReview] = useState<{
    body: Schema<"BanWrite">;
    impact: Schema<"BanPreview">;
  }>();
  const [error, setError] = useState<Error | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const action = useAction();
  const toggleKind = (kind: string) => {
    setAllEvents(false);
    setKinds(
      kinds.includes(kind) ? kinds.filter((k) => k !== kind) : [...kinds, kind],
    );
  };
  return (
    <Dialog
      title={`${review ? "Review ban" : "Ban member"} · ${person.name}`}
      onClose={onClose}
      wide
      className="ban-dialog"
    >
      {review ? (
        <>
          <p>
            <strong>Scope:</strong>{" "}
            {restrictionScope({
              ...review.body,
              event_kinds: review.body.event_kinds || [],
              id: 0,
              created_at: "",
              events: allEvents ? [] : events,
              expires_at: review.body.expires_at || null,
              message,
            })}
          </p>
          <p>
            <strong>Duration:</strong>{" "}
            {review.body.expires_at
              ? `Until ${dateLabel(review.body.expires_at)}, ${clock(review.body.expires_at)} Pacific`
              : "Permanent, until lifted"}
          </p>
          <p className="preserve-lines">
            <strong>Private officer reason:</strong> {reason}
          </p>
          <p className="preserve-lines">
            <strong>Message for member:</strong>{" "}
            {message ||
              "A neutral notice with scope, duration, and officer contact information."}
          </p>
          <div className="notice">
            <strong>
              {review.impact.total} upcoming signup
              {review.impact.total === 1 ? "" : "s"} will be cancelled
            </strong>
            <ul>
              {review.impact.items.map((item) => (
                <li key={item.signup_id}>
                  {item.name} · {dateLabel(item.starts_at)}
                </li>
              ))}
            </ul>
          </div>
          <Message error={action.error} />
          <div className="sticky-actions">
            <Button
              variant="secondary"
              disabled={action.isPending}
              onClick={() => setReview(undefined)}
            >
              Back
            </Button>
            <Button
              variant="danger"
              disabled={action.isPending}
              onClick={() =>
                void action
                  .mutateAsync({
                    url: `/api/admin/members/${person.id}/bans`,
                    body: review.body,
                  })
                  .then(onClose)
                  .catch(() => {})
              }
            >
              Confirm Ban
            </Button>
          </div>
        </>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setPreviewing(true);
            try {
              const body: Schema<"BanWrite"> = {
                all_events: allEvents,
                event_kinds: allEvents
                  ? []
                  : (kinds as Schema<"BanWrite">["event_kinds"]),
                event_ids: allEvents ? [] : events.map((e) => e.id),
                membership,
                expires_at: permanent ? null : fromPacific(expires),
                reason: reason.trim(),
                message: message.trim(),
                request_id: requestId,
              };
              if (
                !permanent &&
                (!body.expires_at || Date.parse(body.expires_at) <= Date.now())
              )
                throw new Error("Choose a future expiry in Pacific time.");
              const {
                reason: _reason,
                message: _message,
                request_id: _request,
                ...scope
              } = body;
              const impact = await request<Schema<"BanPreview">>(
                `/api/admin/members/${person.id}/bans/preview`,
                "POST",
                scope,
              );
              setReview({ body, impact });
            } catch (err) {
              setError(err as Error);
            } finally {
              setPreviewing(false);
            }
          }}
        >
          <fieldset className="ban-scope">
            <legend>Ban scope</legend>
            <p className="ban-scope-label">Event signups</p>
            <div
              className="ban-category-buttons"
              role="group"
              aria-label="Event categories"
            >
              <Button
                type="button"
                variant="secondary"
                aria-pressed={allEvents}
                onClick={() => {
                  setAllEvents(!allEvents);
                  setKinds([]);
                  setEvents([]);
                }}
              >
                All
              </Button>
              {Object.entries(eventKindLabels).map(([kind, label]) => (
                <Button
                  key={kind}
                  type="button"
                  variant="secondary"
                  aria-pressed={kinds.includes(kind)}
                  onClick={() => toggleKind(kind)}
                >
                  {label}
                </Button>
              ))}
            </div>
            {!allEvents && (
              <>
                <details>
                  <summary>Choose specific events (optional)</summary>
                  <label className="field">
                    Find events in quarter
                    <select
                      value={qid}
                      onChange={(e) => {
                        setQid(e.target.value);
                        setOffset(0);
                      }}
                    >
                      {quarters.map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Field
                    label="Search specific events"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setOffset(0);
                    }}
                  />
                  {!!qid &&
                    (choices.isPending ? (
                      <Loading />
                    ) : choices.error ? (
                      <Failure error={choices.error} retry={choices.refetch} />
                    ) : (
                      <>
                        <div className="ban-event-options">
                          {choices.data.items
                            .filter((e) => Date.parse(e.starts_at) > Date.now())
                            .map((event) => (
                              <label key={event.id}>
                                <input
                                  type="checkbox"
                                  checked={events.some(
                                    (e) => e.id === event.id,
                                  )}
                                  onChange={() =>
                                    setEvents(
                                      events.some((e) => e.id === event.id)
                                        ? events.filter(
                                            (e) => e.id !== event.id,
                                          )
                                        : [
                                            ...events,
                                            { id: event.id, name: event.name },
                                          ],
                                    )
                                  }
                                />
                                <span>
                                  {event.name}
                                  <small>{dateLabel(event.starts_at)}</small>
                                </span>
                              </label>
                            ))}
                        </div>
                        <div className="actions">
                          <Button
                            type="button"
                            variant="quiet"
                            disabled={!offset}
                            onClick={() => setOffset(offset - 50)}
                          >
                            Previous events
                          </Button>
                          <Button
                            type="button"
                            variant="quiet"
                            disabled={offset + 50 >= choices.data.total}
                            onClick={() => setOffset(offset + 50)}
                          >
                            Next events
                          </Button>
                        </div>
                      </>
                    ))}
                </details>
                {events.length > 0 && (
                  <p>
                    Selected: {events.map((e) => e.name).join(", ")}{" "}
                    <Button
                      type="button"
                      variant="quiet"
                      onClick={() => setEvents([])}
                    >
                      Clear selected events
                    </Button>
                  </p>
                )}
              </>
            )}
            <label className="ban-check">
              <input
                type="checkbox"
                checked={membership}
                onChange={(e) => setMembership(e.target.checked)}
              />
              Membership signups and new approvals
            </label>
          </fieldset>
          <div className="form-grid single-phone ban-duration">
            <label className="field">
              Duration
              <select
                value={permanent ? "permanent" : "temporary"}
                onChange={(e) => setPermanent(e.target.value === "permanent")}
              >
                <option value="temporary">Temporary</option>
                <option value="permanent">Permanent</option>
              </select>
            </label>
            {!permanent && (
              <Field
                label="Ban ends · Pacific"
                type="datetime-local"
                value={expires}
                required
                onChange={(e) => setExpires(e.target.value)}
              />
            )}
          </div>
          <label className="field">
            Private officer reason
            <textarea
              required
              maxLength={2000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <small>Only officers can see this reason.</small>
          </label>
          <label className="field">
            Message for member (optional)
            <textarea
              maxLength={1000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <small>
              Use neutral restriction language. Scope, duration, and contact
              guidance are always included.
            </small>
          </label>
          <Message error={error} />
          <div className="sticky-actions">
            <Button type="button" variant="quiet" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={previewing}>Review Ban</Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

export function MemberBans({ person }: { person: Person }) {
  const query = useAPI(
    "Items_BanView_",
    `/api/admin/members/${person.id}/bans`,
  );
  const [creating, setCreating] = useState(false);
  const [lifting, setLifting] = useState<Schema<"BanView">>();
  const [reason, setReason] = useState("");
  const action = useAction();
  return (
    <section className="section">
      <div className="section-heading">
        <h3>Bans</h3>
        <Button variant="danger" onClick={() => setCreating(true)}>
          Ban Member
        </Button>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <Failure error={query.error} retry={query.refetch} />
      ) : query.data.items.length ? (
        <div className="stack">
          {query.data.items.map((ban) => (
            <div className="ban-history" key={ban.id}>
              <div className="section-heading">
                <strong>{restrictionScope(ban)}</strong>
                <Pill tone={ban.status === "active" ? "yellow" : "gray"}>
                  {ban.status === "active"
                    ? "Banned"
                    : ban.status === "expired"
                      ? "Expired"
                      : "Lifted"}
                </Pill>
              </div>
              <p>
                {ban.expires_at
                  ? `Until ${dateLabel(ban.expires_at)}, ${clock(ban.expires_at)} Pacific`
                  : "Permanent"}{" "}
                · Created {dateLabel(ban.created_at)} by officer #
                {ban.created_by}
              </p>
              <p className="preserve-lines">
                <strong>Private reason:</strong> {ban.reason}
              </p>
              <p className="preserve-lines">
                <strong>Member message:</strong>{" "}
                {ban.message || "Default restriction notice"}
              </p>
              {ban.lifted_at && (
                <p className="preserve-lines">
                  Lifted {dateLabel(ban.lifted_at)} by officer #{ban.lifted_by}:{" "}
                  {ban.lift_reason}
                </p>
              )}
              {ban.status === "active" && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    action.reset();
                    setReason("");
                    setLifting(ban);
                  }}
                >
                  Lift Ban
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Empty title="No ban history">This member has no recorded bans.</Empty>
      )}
      {creating && (
        <MemberBanForm person={person} onClose={() => setCreating(false)} />
      )}
      {lifting && (
        <Dialog
          title={`Lift ban · ${person.name}`}
          onClose={() => setLifting(undefined)}
          className="ban-dialog"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action
                .mutateAsync({
                  url: `/api/admin/members/${person.id}/bans/${lifting.id}/lift`,
                  body: { reason },
                })
                .then(() => setLifting(undefined))
                .catch(() => {});
            }}
          >
            <p>{restrictionScope(lifting)}</p>
            <p>
              Cancelled signups will not be restored. Other active matching bans
              still apply.
            </p>
            <label className="field">
              Private reason for lifting
              <textarea
                required
                maxLength={2000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <Message error={action.error} />
            <div className="sticky-actions">
              <Button
                type="button"
                variant="quiet"
                onClick={() => setLifting(undefined)}
              >
                Keep Ban
              </Button>
              <Button disabled={action.isPending}>Confirm Lift</Button>
            </div>
          </form>
        </Dialog>
      )}
    </section>
  );
}
