import { useState } from "react";
import { Link } from "react-router";
import { useAPI, useAction, pacificDate } from "../lib/api";
import { useSearchQuery } from "../lib/search-query";
import { Button, Field, Loading, Message, Panel } from "./ui";

export function GearWarning() {
  return <small className="gear-warning">Officer owned / not guaranteed</small>;
}

export function GearRequestForm({
  assign = false,
  onSaved,
}: {
  assign?: boolean;
  onSaved: () => void;
}) {
  const [start, setStart] = useState(pacificDate());
  const [end, setEnd] = useState(start);
  const [search, setSearch] = useState("");
  const [person, setPerson] = useState<{ id: number; name: string } | null>(
    null,
  );
  const [ids, setIds] = useState<number[]>([]);
  const [activity, setActivity] = useState("");
  const [comments, setComments] = useState("");
  const [reason, setReason] = useState("");
  const action = useAction();
  const lookup = useSearchQuery(search);
  const people = useAPI(
    "MemberList",
    "/api/admin/member-lookup?search=" + encodeURIComponent(lookup.query),
    {
      enabled: assign && !!lookup.query && !person,
    },
  );
  const long = (Date.parse(end) - Date.parse(start)) / 86400000 >= 7;
  const datesValid = !!start && !!end && start >= pacificDate() && end >= start;
  const ready = datesValid && (!assign || !!person);
  const path = assign
    ? "/api/admin/gear/catalog?member_id=" + person?.id + "&"
    : "/api/gear?";
  const catalog = useAPI(
    "GearCatalog",
    path + new URLSearchParams({ start, end }),
    { enabled: ready, poll: ready },
  );
  const data = ready ? catalog.data : undefined;
  const choices = data?.items || [];
  const selected = choices.filter((i) => ids.includes(i.id));
  const valid =
    !!data?.eligible &&
    ids.length > 0 &&
    selected.length === ids.length &&
    selected.every((i) => i.available > 0 && !i.type_reserved) &&
    (!long || assign);
  return (
    <form
      className="stack gear-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid || action.isPending) return;
        await action
          .mutateAsync({
            url: assign ? "/api/admin/gear/rentals" : "/api/me/gear-rentals",
            body: {
              start,
              end,
              item_ids: ids,
              activity,
              comments,
              ...(assign ? { member_id: person?.id, reason } : {}),
            },
          })
          .then(onSaved)
          .catch(() => {});
      }}
    >
      {assign && (
        <Panel>
          <h3>Borrower</h3>
          {person ? (
            <div className="toolbar">
              <strong>{person.name}</strong>
              <Button
                type="button"
                variant="quiet"
                onClick={() => {
                  setPerson(null);
                  setIds([]);
                }}
              >
                Change member
              </Button>
            </div>
          ) : (
            <>
              <Field
                label="Search members"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {people.error && <Message error={people.error} />}
              {!lookup.pending &&
                lookup.query &&
                people.data?.items.map(({ member }) => (
                  <Button
                    type="button"
                    key={member.id}
                    variant="quiet"
                    disabled={member.approval_status !== "approved"}
                    onClick={() => setPerson(member)}
                  >
                    {member.name} · {member.email}
                  </Button>
                ))}
              {!!lookup.query &&
                !lookup.pending &&
                people.data?.items.length === 0 && <p>No matching members.</p>}
            </>
          )}
        </Panel>
      )}
      <Panel>
        <h2>Rental dates</h2>
        <p className="muted">
          Borrow for up to seven days, including pickup and return. Contact an
          officer for a longer trip.
        </p>
        <div className="gear-fields">
          <Field
            label="Pickup date"
            type="date"
            required
            min={pacificDate()}
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              if (end < e.target.value) setEnd(e.target.value);
            }}
          />
          <Field
            label="Return date"
            type="date"
            required
            min={start}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
        {long &&
          (assign ? (
            <Field
              label="Reason for longer rental"
              required
              maxLength={2000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          ) : (
            <Message>
              Choose up to seven calendar days or ask an officer about a longer
              rental.
            </Message>
          ))}
      </Panel>
      {ready && catalog.isPending && <Loading />}
      {ready && catalog.error && <Message error={catalog.error} />}
      {data && (
        <Panel>
          <h2>Choose gear</h2>
          {!data.eligible && (
            <Message>
              {data.quarter_id
                ? `Approved paid membership in ${data.quarter_name} is required.`
                : "No membership quarter covers this pickup date."}
              {!assign && data.quarter_id && (
                <>
                  {" "}
                  <Link to={`/membership?quarter=${data.quarter_id}`}>
                    View membership
                  </Link>
                </>
              )}
            </Message>
          )}
          <p className="muted">
            Choose one item per type. Your request holds a unit while an officer
            reviews it.
          </p>
          {choices.length === 0 && <p>No rentable inventory is listed.</p>}
          {Array.from(new Set(choices.map((i) => i.type_id))).map((typeId) => (
            <fieldset className="gear-options" key={typeId}>
              <legend>
                {choices.find((i) => i.type_id === typeId)?.type_name}
              </legend>
              {choices
                .filter((i) => i.type_id === typeId)
                .map((i) => {
                  const checked = ids.includes(i.id);
                  const blocked =
                    !data.eligible ||
                    !i.available ||
                    i.type_reserved ||
                    selected.some((s) => s.type_id === typeId);
                  return (
                    <label key={i.id}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!checked && blocked}
                        onChange={() =>
                          setIds(
                            checked
                              ? ids.filter((id) => id !== i.id)
                              : [...ids, i.id],
                          )
                        }
                      />
                      <span>
                        <strong>{i.name}</strong>
                        {i.description && <small>{i.description}</small>}
                        {i.ownership === "officer" && <GearWarning />}
                      </span>
                      <small>
                        {i.type_reserved
                          ? "Already requested for these dates"
                          : i.available
                            ? i.available + " available"
                            : "Unavailable"}
                      </small>
                    </label>
                  );
                })}
            </fieldset>
          ))}
          {ids.length > selected.length && (
            <Message>
              A selected item was removed.{" "}
              <Button
                type="button"
                variant="quiet"
                onClick={() => setIds(selected.map((i) => i.id))}
              >
                Remove unavailable items
              </Button>
            </Message>
          )}
        </Panel>
      )}
      {data?.eligible && (
        <Panel>
          <h2>Rental details</h2>
          <label>
            Trip or activity
            <textarea
              required
              maxLength={2000}
              value={activity}
              placeholder="Camping in Big Bear"
              onChange={(e) => setActivity(e.target.value)}
            />
          </label>
          <label>
            Logistical comments (optional)
            <textarea
              maxLength={2000}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
          </label>
          {selected.length > 0 && (
            <p>
              <strong>Selected gear</strong> ·{" "}
              {selected.map((i) => i.name).join(", ")}{" "}
              {selected.some((i) => i.ownership === "officer") && (
                <GearWarning />
              )}
            </p>
          )}
          <Message error={action.error} />
          <Button disabled={!valid || !activity.trim() || action.isPending}>
            {assign ? "Assign and approve rental" : "Submit gear request"}
          </Button>
        </Panel>
      )}
    </form>
  );
}
