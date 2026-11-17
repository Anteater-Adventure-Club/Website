import { useState, Fragment } from "react";
import { useSearchParams } from "react-router";
import { dateLabel, pacificDate, useAction, useAPI } from "../lib/api";
import type { Schema } from "../lib/api";
import {
  Button,
  Dialog,
  Field,
  Loading,
  Message,
  PageHeading,
  Panel,
  Pill,
} from "../components/ui";
import { GearRequestForm, GearWarning } from "../components/gear-request";
import { useIdentity } from "../lib/context";
import { needsApproval } from "../lib/approval";
import { GearMembershipCard } from "../components/gear-membership";
import { GearInventory } from "../components/gear-inventory";

type Rental = Schema<"GearRentalView">;
type Line = Schema<"GearLineView">;
type Action = Schema<"GearAction">["action"];
const labels: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  denied: "Denied",
  picked_up: "Picked up",
  returned: "Returned",
  cancelled: "Cancelled",
  mixed: "Mixed status",
  overdue: "Overdue",
  missed: "Missed pickup",
  at_risk: "At risk",
};
const actions: Record<Action, string> = {
  approve: "Approve",
  deny: "Deny",
  pickup: "Record pickup",
  return: "Record return",
  cancel: "Cancel",
};
const prettyDate = (v: string) =>
  dateLabel(v, { month: "short", day: "numeric", year: "numeric" });
const rentalPeriod = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
function allowed(line: Line, r: Rental, admin: boolean): Action[] {
  if (line.status === "picked_up") return admin ? ["return"] : [];
  if (line.status === "pending")
    return admin
      ? line.missed
        ? ["deny", "cancel"]
        : ["approve", "deny", "cancel"]
      : ["cancel"];
  if (line.status === "approved")
    return admin && !line.missed && r.start <= pacificDate()
      ? ["pickup", "cancel"]
      : ["cancel"];
  return [];
}
type Edit = { r: Rental; action: Action | "dates"; lines: Line[] };
function RentalDialog({
  edit,
  admin,
  close,
}: {
  edit: Edit;
  admin: boolean;
  close: () => void;
}) {
  const mutation = useAction();
  const [start, setStart] = useState(edit.r.start);
  const [end, setEnd] = useState(edit.r.end);
  const [message, setMessage] = useState("");
  const isDates = edit.action === "dates";
  const verb = isDates ? "Change rental dates" : actions[edit.action as Action];
  const long = (Date.parse(end) - Date.parse(start)) / 86400000 >= 7;
  const title = verb + " · Rental #" + edit.r.id;
  return (
    <Dialog title={title} onClose={close}>
      <form
        className="stack gear-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const base =
            (admin ? "/api/admin/gear/rentals/" : "/api/me/gear-rentals/") +
            edit.r.id;
          await mutation
            .mutateAsync({
              url: base + (isDates ? "/dates" : admin ? "/actions" : "/cancel"),
              method: isDates ? "PUT" : "POST",
              body: {
                expected_revision: edit.r.revision,
                ...(isDates
                  ? { start, end, reason: message }
                  : {
                      line_ids: edit.lines.map((l) => l.id),
                      ...(admin ? { action: edit.action, message } : {}),
                    }),
              },
            })
            .then(close)
            .catch(() => {});
        }}
      >
        {isDates ? (
          <>
            <div className="gear-fields">
              <Field
                label="Pickup date"
                required
                type="date"
                value={start}
                disabled={edit.r.lines.some((l) =>
                  ["picked_up", "returned"].includes(l.status),
                )}
                onChange={(e) => setStart(e.target.value)}
              />
              <Field
                label="Return date"
                required
                type="date"
                min={start}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
            <Field
              label={long ? "Reason for longer rental" : "Reason (optional)"}
              required={long}
              value={message}
              maxLength={2000}
              onChange={(e) => setMessage(e.target.value)}
            />
          </>
        ) : (
          <>
            <ul>
              {edit.lines.map((l) => (
                <li key={l.id}>{l.name}</li>
              ))}
            </ul>
            {admin && ["approve", "deny", "cancel"].includes(edit.action) && (
              <label>
                Message for member (optional)
                <textarea
                  maxLength={2000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </label>
            )}
          </>
        )}
        <Message error={mutation.error} />
        <div className="actions">
          <Button disabled={mutation.isPending}>{verb}</Button>
          <Button type="button" variant="quiet" onClick={close}>
            Close
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
type RentalActionsProps = {
  r: Rental;
  admin: boolean;
  setEdit: (value: Edit) => void;
};
function RentalItems({ r, admin, setEdit }: RentalActionsProps) {
  return (
    <>
      {" "}
      <div className="gear-lines">
        {r.lines.map((l) => (
          <div key={l.id}>
            <div>
              <strong>{l.name}</strong> · {l.type_name}
              {l.ownership === "officer" && <GearWarning />}
              <small>
                {labels[l.status]}
                {l.overdue
                  ? " · Overdue"
                  : l.missed
                    ? " · Missed pickup"
                    : l.at_risk
                      ? " · At risk from an overdue return"
                      : ""}
              </small>
              {l.message && <p>{l.message}</p>}
            </div>
            <div className="actions gear-row-actions">
              {allowed(l, r, admin).map((a) => (
                <Button
                  key={a}
                  variant={
                    a === "approve" || a === "pickup" || a === "return"
                      ? "primary"
                      : "secondary"
                  }
                  className="small"
                  onClick={() => setEdit({ r, action: a, lines: [l] })}
                >
                  {actions[a]}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {admin && (
        <div className="actions">
          {(["approve", "pickup", "return"] as Action[]).map((a) => {
            const lines = r.lines.filter((l) =>
              allowed(l, r, true).includes(a),
            );
            return (
              lines.length > 1 && (
                <Button
                  key={a}
                  variant="secondary"
                  onClick={() => setEdit({ r, action: a, lines })}
                >
                  {a === "approve"
                    ? "Approve all pending"
                    : actions[a] + " for all eligible items"}
                </Button>
              )
            );
          })}
          {r.lines.some((l) =>
            ["pending", "approved", "picked_up"].includes(l.status),
          ) && (
            <Button
              variant="secondary"
              onClick={() => setEdit({ r, action: "dates", lines: r.lines })}
            >
              Change dates
            </Button>
          )}
        </div>
      )}
    </>
  );
}

function OfficerRentalTable({
  rows,
  setEdit,
}: {
  rows: Rental[];
  setEdit: (value: Edit) => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  return (
    <div className="table-wrapper">
      <table
        className="record-table gear-table"
        aria-label="Gear rental requests"
      >
        <thead>
          <tr>
            <th scope="col">Borrower / trip</th>
            <th scope="col">Rental period</th>
            <th scope="col">Gear</th>
            <th scope="col">Status</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const open = expanded === r.id;
            const flagged = [
              ...new Set(
                r.lines.flatMap((l) =>
                  l.overdue
                    ? ["Overdue"]
                    : l.missed
                      ? ["Missed pickup"]
                      : l.at_risk
                        ? ["At risk"]
                        : [],
                ),
              ),
            ];
            const canApprove = r.lines.filter((l) =>
              allowed(l, r, true).includes("approve"),
            );
            return (
              <Fragment key={r.id}>
                <tr>
                  <td data-label="Borrower / trip">
                    <div>
                      <strong>{r.member_name}</strong>
                      <small>
                        #{r.id} · {r.activity}
                      </small>
                    </div>
                  </td>
                  <td data-label="Rental period">
                    <span>
                      {rentalPeriod.formatRange(
                        new Date(r.start),
                        new Date(r.end),
                      )}
                    </span>
                  </td>
                  <td data-label="Gear">
                    <span>{r.lines.map((l) => l.name).join(", ")}</span>
                  </td>
                  <td data-label="Status">
                    <div>
                      <Pill tone={r.status === "pending" ? "yellow" : "green"}>
                        {labels[r.status]}
                      </Pill>
                      {flagged.length > 0 && (
                        <small>{flagged.join(" · ")}</small>
                      )}
                    </div>
                  </td>
                  <td data-label="Actions">
                    <div className="actions gear-row-actions">
                      {!!canApprove.length && !open && (
                        <Button
                          className="small"
                          onClick={() =>
                            setEdit({ r, action: "approve", lines: canApprove })
                          }
                        >
                          {canApprove.length === 1 ? "Approve" : "Approve all"}
                        </Button>
                      )}
                      <Button
                        className="small"
                        variant="secondary"
                        aria-expanded={open}
                        aria-controls={
                          open ? `gear-details-${r.id}` : undefined
                        }
                        onClick={() => setExpanded(open ? null : r.id)}
                      >
                        {open ? "Hide details" : "Details"}
                      </Button>
                    </div>
                  </td>
                </tr>
                {open && (
                  <tr className="gear-detail-row">
                    <td colSpan={5} id={`gear-details-${r.id}`}>
                      <div className="gear-request-detail">
                        <h3>
                          Rental #{r.id} · {r.member_name}
                        </h3>
                        {r.comments && <p>{r.comments}</p>}
                        <RentalItems r={r} admin setEdit={setEdit} />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Rentals({ admin = false }: { admin?: boolean }) {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [edit, setEdit] = useState<Edit | null>(null);
  const data = useAPI(
    "Items_GearRentalView_",
    admin ? "/api/admin/gear/rentals" : "/api/me/gear-rentals",
    { poll: true },
  );
  const status = params.get("status") || "all";
  if (data.error) return <Message error={data.error} />;
  if (!data.data) return <Loading />;
  const rows = data.data.items.filter(
    (r) =>
      [r.member_name, r.activity, ...r.lines.map((l) => l.name)]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (status === "all" ||
        r.lines.some((l) =>
          status === "pending"
            ? l.status === "pending" && !l.missed
            : l.status === status ||
              (status === "overdue" && l.overdue) ||
              (status === "missed" && l.missed) ||
              (status === "at_risk" && l.at_risk),
        )),
  );
  return (
    <div className="stack">
      <div className="gear-filters">
        <Field
          label="Search rentals"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="field">
          Rental status
          <select
            value={status}
            onChange={(e) => {
              const p = new URLSearchParams(params);
              p.set("status", e.target.value);
              setParams(p);
            }}
          >
            <option value="all">All rentals</option>
            {Object.entries(labels)
              .filter(([k]) => k !== "mixed")
              .map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
          </select>
        </label>
      </div>
      {!rows.length && (
        <Panel>
          <h3>No matching rentals</h3>
          <p>Requests and their decisions will appear here.</p>
        </Panel>
      )}
      {!!rows.length && admin && (
        <OfficerRentalTable rows={rows} setEdit={setEdit} />
      )}
      {!admin &&
        rows.map((r) => (
          <Panel key={r.id}>
            <div className="toolbar">
              <div>
                <small>Rental #{r.id}</small>
                <h2>{r.activity}</h2>
              </div>
              <Pill tone={r.status === "pending" ? "yellow" : "green"}>
                {labels[r.status]}
              </Pill>
            </div>
            <p>
              {prettyDate(r.start)} – {prettyDate(r.end)}
            </p>
            {r.comments && <p>{r.comments}</p>}
            <RentalItems r={r} admin={false} setEdit={setEdit} />
          </Panel>
        ))}
      {edit && (
        <RentalDialog edit={edit} admin={admin} close={() => setEdit(null)} />
      )}
    </div>
  );
}
export function MemberGear() {
  const [params, setParams] = useSearchParams();
  const [notice, setNotice] = useState("");
  const { session } = useIdentity();
  const history = params.get("tab") === "rentals";
  if (needsApproval(session?.member)) {
    const status = session?.member?.approval_status;
    const title =
      status === "pending"
        ? "Your application is being reviewed"
        : status === "denied"
          ? "Your application was not approved"
          : "Apply for AAC membership";
    return (
      <div className="stack">
        <PageHeading title="Gear Rental" />
        <GearMembershipCard
          eyebrow="Club membership"
          title={title}
          link={{
            to: "/my-aac/application",
            label:
              status === "required" ? "Start application" : "View application",
          }}
        >
          Gear rental is available to approved club members who have paid dues
          for the pickup quarter.
        </GearMembershipCard>
      </div>
    );
  }
  return (
    <div className="stack">
      <PageHeading
        title="Gear Rental"
        subtitle="Borrow club equipment for your next trip."
      />
      <div className="actions">
        <Button
          variant={history ? "secondary" : "primary"}
          onClick={() => {
            setNotice("");
            setParams({});
          }}
        >
          Request gear
        </Button>
        <Button
          variant={history ? "primary" : "secondary"}
          onClick={() => setParams({ tab: "rentals" })}
        >
          My rentals
        </Button>
      </div>
      <Message>{notice}</Message>
      {history ? (
        <Rentals />
      ) : (
        <GearRequestForm
          onSaved={() => {
            setNotice(
              "Request submitted. Your gear is reserved pending officer approval.",
            );
            setParams({ tab: "rentals" });
          }}
        />
      )}
    </div>
  );
}
export function AdminGear() {
  const [params, setParams] = useSearchParams();
  const view = params.get("tab") || "rentals";
  const [notice, setNotice] = useState("");
  return (
    <div className="stack">
      <PageHeading
        title="Gear"
        subtitle="Manage equipment, rental requests, and returns."
      />
      <div className="actions">
        {[
          ["rentals", "Rentals"],
          ["inventory", "Inventory"],
          ["assign", "Assign gear"],
        ].map(([v, label]) => (
          <Button
            key={v}
            variant={view === v ? "primary" : "secondary"}
            onClick={() => {
              setNotice("");
              setParams({ tab: v });
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      <Message>{notice}</Message>
      {view === "inventory" ? (
        <GearInventory />
      ) : view === "assign" ? (
        <GearRequestForm
          assign
          onSaved={() => {
            setNotice("Gear assigned and approved.");
            setParams({ tab: "rentals" });
          }}
        />
      ) : (
        <Rentals admin />
      )}
    </div>
  );
}
