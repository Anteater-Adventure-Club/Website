import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { request, useAction, useAPI } from "../lib/api";
import type { Person, Schema } from "../lib/api";
import { Button, Dialog, Field, Message, Pill } from "./ui";
import { quarterURL } from "../lib/context";
import { useSearchQuery } from "../lib/search-query";

export function DeleteEventButton({
  url,
  revision,
  name,
  quarterId,
  count,
  state = "draft",
}: {
  url: string;
  revision: number;
  name: string;
  quarterId: number;
  count?: number;
  state?: "draft" | "cancelled";
}) {
  const [confirm, setConfirm] = useState(false);
  const action = useAction();
  const navigate = useNavigate();
  const label =
    state === "cancelled"
      ? "Delete Event"
      : count === undefined
        ? "Delete Draft"
        : "Delete Draft Series";
  return (
    <>
      <Button
        type="button"
        variant="danger"
        onClick={() => {
          action.reset();
          setConfirm(true);
        }}
      >
        {label}
      </Button>
      {confirm && (
        <Dialog
          title={
            state === "cancelled"
              ? "Delete this cancelled event?"
              : count === undefined
                ? "Delete this draft?"
                : "Delete this draft series?"
          }
          onClose={() => setConfirm(false)}
        >
          <p>
            Permanently delete {name}
            {count === undefined ? "?" : ` and all ${count} draft dates?`}
          </p>
          {state === "cancelled" && (
            <p>
              This removes the event from the calendar and events list. Events
              with participation or published recaps must be kept for history.
            </p>
          )}
          <Message error={action.error} />
          <div className="form-actions">
            <Button
              type="button"
              variant="quiet"
              onClick={() => setConfirm(false)}
            >
              {state === "cancelled" ? "Keep Event" : "Keep Draft"}
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={action.isPending}
              onClick={() => {
                void action
                  .mutateAsync({
                    url,
                    method: "DELETE",
                    body: { expected_revision: revision },
                  })
                  .then(() => {
                    setConfirm(false);
                    navigate(quarterURL("/admin/events", quarterId));
                  })
                  .catch(() => {});
              }}
            >
              {label}
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}

export function PersonDialog({
  onClose,
  onSelect,
  title = "Add a member",
}: {
  onClose: () => void;
  onSelect?: (person: Person) => void;
  title?: string;
}) {
  const form = useForm<Schema<"MemberInput">>({
    defaultValues: { name: "", email: "", phone: "", student: true },
  });
  const action = useAction<Person>();
  const [lookup, setLookup] = useState("");
  const [search, setSearch] = useState("");
  const { query: searchQuery, pending: searching } = useSearchQuery(search);
  const canSearch = !!onSelect && searchQuery.length > 1;
  const existing = useAPI(
    "MemberList",
    `/api/admin/members?search=${encodeURIComponent(searchQuery)}&limit=10`,
    { enabled: canSearch && !searching },
  );
  async function directory() {
    const email = form.getValues("email")?.trim();
    if (!email) return;
    setLookup("Looking in the UCI directory…");
    try {
      const result = await request<{ name: string | null; status: string }>(
        `/api/admin/directory?email=${encodeURIComponent(email)}`,
      );
      if (result.name) {
        form.setValue("name", result.name);
        setLookup("Found in the UCI directory. Name filled in.");
      } else
        setLookup(
          result.status === "unavailable"
            ? "The directory is unavailable. Enter the name manually."
            : "No exact directory match. Enter the name manually.",
        );
    } catch {
      setLookup("No directory result. You can enter the name manually.");
    }
  }
  return (
    <Dialog title={title} onClose={onClose}>
      <form
        onSubmit={form.handleSubmit(async (body) => {
          const value = { ...body, email: body.email?.trim() || null };
          await action
            .mutateAsync({ url: "/api/admin/members", body: value })
            .then((person) => {
              onSelect?.(person);
              onClose();
            })
            .catch(() => {});
        })}
      >
        {onSelect && (
          <>
            <Field
              label="Find an existing member"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
              placeholder="Search name or email"
            />
            {(searching || (canSearch && existing.isPending)) && (
              <small role="status">Searching…</small>
            )}
            {!searching && canSearch && existing.error && (
              <>
                <Message error={existing.error} />
                <Button
                  type="button"
                  variant="quiet"
                  onClick={() => existing.refetch()}
                >
                  Retry
                </Button>
              </>
            )}
            {!searching &&
              canSearch &&
              existing.isSuccess &&
              !existing.data.items.length && (
                <small role="status">
                  No close matches. Try another name or email.
                </small>
              )}
            {!searching && canSearch && existing.isSuccess && (
              <div className="scroll-list">
                {existing.data.items.map(({ member }) => (
                  <button
                    className="member-option"
                    type="button"
                    key={member.id}
                    onClick={() => {
                      onSelect(member);
                      onClose();
                    }}
                  >
                    <strong>{member.name}</strong>
                    <small>{member.email || "No email saved"}</small>
                  </button>
                ))}
              </div>
            )}
            <hr />
          </>
        )}
        <Field
          label="UCI email or other email"
          type="email"
          maxLength={254}
          {...form.register("email")}
          hint="A named walk-in can be added without an email."
        />
        <div className="actions">
          <Button type="button" variant="secondary" onClick={directory}>
            Look up in UCI directory
          </Button>
        </div>
        {lookup && <Message>{lookup}</Message>}
        <div className="form-grid">
          <Field
            label="Name"
            required
            maxLength={100}
            autoComplete="name"
            {...form.register("name")}
          />
          <Field
            label="Phone"
            type="tel"
            maxLength={40}
            autoComplete="tel"
            {...form.register("phone")}
          />
        </div>
        <label className="check-field">
          <input type="checkbox" {...form.register("student")} />
          UCI student
        </label>
        <Message error={action.error} />
        <div className="sticky-actions">
          <Button type="button" variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={action.isPending}>Save Member</Button>
        </div>
      </form>
    </Dialog>
  );
}

export function ImportDialog({
  quarterId,
  eventId,
  onClose,
}: {
  quarterId: number;
  eventId?: number;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"members" | "paid_members" | "participants">(
    eventId ? "participants" : "members",
  );
  const [content, setContent] = useState("");
  const [fileError, setFileError] = useState<Error | null>(null);
  const [role, setRole] = useState<"ride" | "driver" | "own">("ride");
  const [preview, setPreview] = useState<Schema<"ImportView"> | null>(null);
  const [outcome, setOutcome] = useState<Schema<"ImportOutcome"> | null>(null);
  const previewAction = useAction<Schema<"ImportView">>();
  const applyAction = useAction<Schema<"ImportOutcome">>();
  return (
    <Dialog
      title={eventId ? "Import participants" : "Import members"}
      onClose={onClose}
      wide
    >
      {outcome ? (
        <>
          <h3>Import complete</h3>
          <p>
            {outcome.created} created · {outcome.reused} existing members ·{" "}
            {outcome.skipped} existing signups kept.
          </p>
          <Button onClick={onClose}>Done</Button>
        </>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setPreview(null);
            await previewAction
              .mutateAsync({
                url: "/api/admin/imports/preview",
                body: {
                  mode,
                  quarter_id: quarterId,
                  event_id: eventId || null,
                  text: content,
                  fallback_role: role,
                },
              })
              .then(setPreview)
              .catch(() => {});
          }}
        >
          {!eventId && (
            <label className="field">
              Import type
              <select
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value as typeof mode);
                  setPreview(null);
                }}
              >
                <option value="members">General members</option>
                <option value="paid_members">
                  Paid members · payment history unknown
                </option>
              </select>
            </label>
          )}
          {eventId && (
            <label className="field">
              Transport when no ride column is supplied
              <select
                value={role}
                onChange={(e) => {
                  setRole(e.target.value as typeof role);
                  setPreview(null);
                }}
              >
                <option value="ride">Needs a ride</option>
                <option value="driver">Driving others</option>
                <option value="own">Own ride</option>
              </select>
            </label>
          )}
          <p className="muted">
            Paste CSV or tab-separated rows, or choose a file. Use Name, Email,
            and Phone columns; headerless rows are supported. Google Forms ride
            and timestamp columns are recognized. At most 1 MiB and 1,000
            people.
          </p>
          <Field
            label="CSV or TSV file"
            type="file"
            accept=".csv,.tsv,text/csv,text/tab-separated-values"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                setFileError(null);
                if (file.size > 1048576) {
                  setFileError(
                    new Error("Choose a CSV or TSV file no larger than 1 MiB."),
                  );
                  previewAction.reset();
                  setContent("");
                  return;
                }
                setContent(await file.text());
                setPreview(null);
              }
            }}
          />
          <label className="field">
            Spreadsheet rows
            <textarea
              value={content}
              required
              maxLength={1048576}
              onChange={(e) => {
                setContent(e.target.value);
                setPreview(null);
              }}
              rows={8}
              placeholder={
                "Name,Email,Phone\nAlex Example,alex@uci.edu,9495550100"
              }
            />
          </label>
          {mode === "paid_members" && (
            <Message>
              This grants membership benefits without inventing a dues receipt
              or adding collected dollars.
            </Message>
          )}
          <Message
            error={fileError || previewAction.error || applyAction.error}
          />
          {preview && (
            <div className="import-preview">
              <h3>Preview · {preview.total} rows</h3>
              {preview.issues.map((issue) => (
                <div className="notice error" key={issue.line}>
                  Row {issue.line}: {issue.message}
                </div>
              ))}
              <div className="table-wrapper">
                <table className="record-table">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr key={row.line}>
                        <td data-label="Row">{row.line}</td>
                        <td data-label="Name">{row.name}</td>
                        <td data-label="Email">{row.email}</td>
                        <td data-label="Action">
                          <Pill>{row.action}</Pill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <small>
                Preview expires in 30 minutes. Every error must be fixed before
                applying.
              </small>
            </div>
          )}
          <div className="sticky-actions">
            <Button type="button" variant="quiet" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="secondary" disabled={previewAction.isPending}>
              Preview Import
            </Button>
            {preview?.can_apply && (
              <Button
                type="button"
                disabled={applyAction.isPending}
                onClick={() => {
                  void applyAction
                    .mutateAsync({
                      url: `/api/admin/imports/${preview.id}/apply`,
                      body: { request_hash: preview.request_hash },
                    })
                    .then(setOutcome)
                    .catch(() => {});
                }}
              >
                Apply {preview.rows.length} Rows
              </Button>
            )}
          </div>
        </form>
      )}
    </Dialog>
  );
}

export function ImageUpload({
  purpose,
  label,
  value,
  onChange,
}: {
  purpose: "board" | "event";
  label?: string;
  value?: string | null;
  onChange: (id: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [x, setX] = useState(0.5);
  const [y, setY] = useState(0.5);
  const action = useAction<Schema<"MediaView">>();
  async function upload() {
    if (!file) return;
    const body = new FormData();
    body.set("file", file);
    body.set("purpose", purpose);
    body.set("focal_x", String(x));
    body.set("focal_y", String(y));
    await action
      .mutateAsync({ url: "/api/admin/media", body })
      .then((result) => onChange(result.id))
      .catch(() => {});
  }
  return (
    <div className="stack">
      {value && (
        <img
          className={`upload-preview ${purpose}`}
          src={`/api/admin/media/${value}?variant=medium`}
          alt="Current cropped image"
        />
      )}
      <Field
        label={label || (purpose === "board" ? "Board photo" : "Event photo")}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hint="JPEG, PNG or WebP · 10 MiB and 40 megapixels maximum"
        onChange={(e) => {
          setFile(e.target.files?.[0] || null);
          action.reset();
        }}
      />
      {file && (
        <>
          <div className="form-grid">
            <Field
              label="Crop position · horizontal"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={x}
              onChange={(e) => setX(Number(e.target.value))}
            />
            <Field
              label="Crop position · vertical"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={y}
              onChange={(e) => setY(Number(e.target.value))}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={action.isPending}
            onClick={upload}
          >
            {action.isPending ? "Uploading…" : "Upload & Preview Crop"}
          </Button>
        </>
      )}
      <Message error={action.error} />
    </div>
  );
}

export function SetupQuarter() {
  return (
    <div className="notice">
      Set up your first quarter in <a href="/admin/settings">Settings</a> to
      start managing adventures.
    </div>
  );
}
