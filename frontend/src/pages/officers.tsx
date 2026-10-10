import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { photoURL, useAction, useAPI } from "../lib/api";
import type { Person, Schema } from "../lib/api";
import { useIdentity } from "../lib/context";
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
import { ImageUpload, PersonDialog } from "../components/officer-forms";

type Entry = Schema<"BoardEntryPrivate">;
type Term = Schema<"BoardTermView">;
type Editor = { entry?: Entry; term: Term; position: number };
export function Officers() {
  const terms = useAPI("Items_BoardTermView_", "/api/admin/board/terms");
  const access = useAPI("Items_OfficerView_", "/api/admin/officers");
  const [termId, setTermId] = useState<number | null>(null);
  const current = terms.data?.items.find((t) => t.current);
  const selected =
    terms.data?.items.find((t) => t.id === termId) ||
    current ||
    terms.data?.items[0];
  const board = useAPI(
    "BoardPrivateView",
    `/api/admin/board/terms/${selected?.id}`,
    { enabled: !!selected },
  );
  const [edit, setEdit] = useState<Editor | null>(null);
  const [next, setNext] = useState(false);
  const [grant, setGrant] = useState(false);
  const [revoke, setRevoke] = useState<Schema<"OfficerView"> | null>(null);
  const action = useAction();
  const { session } = useIdentity();
  function openProfile(entry?: Entry) {
    if (!selected || !board.data) return;
    setEdit({
      entry,
      term: selected,
      position: Math.max(-1, ...board.data.entries.map((e) => e.position)) + 1,
    });
  }
  async function reorder(ids: number[]) {
    await action
      .mutateAsync({
        url: `/api/admin/board/terms/${selected?.id}/order`,
        method: "PUT",
        body: { ids, expected_revision: board.data?.term.revision },
      })
      .catch(() => {});
  }
  function move(index: number, direction: number) {
    const ids = board.data?.entries.map((e) => e.id) || [];
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    void reorder(ids);
  }
  return (
    <>
      <PageHeading
        title="Officers & Board"
        subtitle="Public board profiles and officer access are managed separately."
      >
        <Button variant="secondary" onClick={() => setNext(true)}>
          Start Next Board
        </Button>
        <Button
          disabled={!board.data || board.isPending || !!board.error}
          onClick={() => openProfile()}
        >
          <Plus size={16} />
          Add Board Profile
        </Button>
      </PageHeading>
      {terms.isPending ? (
        <Loading />
      ) : terms.error ? (
        <Failure error={terms.error} retry={terms.refetch} />
      ) : (
        <>
          <label className="field board-year">
            Board year
            <select
              value={selected?.id || ""}
              onChange={(e) => setTermId(Number(e.target.value))}
            >
              {terms.data.items.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                  {t.current ? " · Current" : ""}
                </option>
              ))}
            </select>
          </label>
          {!selected ? (
            <Empty
              title="Introduce the board"
              action={
                <Button onClick={() => setNext(true)}>
                  Start a Board Year
                </Button>
              }
            >
              Add officer profiles to publish the club’s current board.
            </Empty>
          ) : board.isPending ? (
            <Loading />
          ) : board.error ? (
            <Failure error={board.error} retry={board.refetch} />
          ) : (
            <div className="stack">
              {board.data.entries.map((entry, index) => (
                <Panel key={entry.id} className="board-edit-row">
                  <span
                    draggable
                    className="drag-handle"
                    aria-label={`Drag ${entry.name} to reorder`}
                    onDragStart={(e) =>
                      e.dataTransfer.setData("text/plain", String(entry.id))
                    }
                  >
                    <GripVertical aria-hidden="true" />
                  </span>
                  <div
                    className="board-row-content"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = Number(e.dataTransfer.getData("text/plain"));
                      const ids = board.data.entries
                        .map((e) => e.id)
                        .filter((i) => i !== id);
                      if (!board.data.entries.some((e) => e.id === id)) return;
                      ids.splice(index, 0, id);
                      void reorder(ids);
                    }}
                  >
                    <img
                      src={
                        entry.photo_id
                          ? photoURL(entry.photo_id, true, "small")
                          : "/images/board-placeholder.svg"
                      }
                      alt=""
                      width={80}
                      height={80}
                    />
                    <div>
                      <h3>{entry.name}</h3>
                      <p>
                        {entry.role} · {entry.major}
                      </p>
                      <div className="actions">
                        <Pill tone={entry.visible ? "green" : "gray"}>
                          {entry.visible ? "Public" : "Hidden"}
                        </Pill>
                        {entry.site_access && <Pill>Site access</Pill>}
                        <Pill tone={entry.palette}>{entry.palette}</Pill>
                      </div>
                    </div>
                  </div>
                  <div className="actions">
                    <Button
                      variant="quiet"
                      aria-label={`Move ${entry.name} up`}
                      disabled={!index || action.isPending}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp size={18} />
                    </Button>
                    <Button
                      variant="quiet"
                      aria-label={`Move ${entry.name} down`}
                      disabled={
                        index === board.data.entries.length - 1 ||
                        action.isPending
                      }
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown size={18} />
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => openProfile(entry)}
                    >
                      Edit Profile
                    </Button>
                  </div>
                </Panel>
              ))}
              {!board.data.entries.length && (
                <Empty
                  title="No profiles in this board yet"
                  action={
                    <Button onClick={() => openProfile()}>
                      Add Board Profile
                    </Button>
                  }
                >
                  Profiles can link to an existing member without granting site
                  access.
                </Empty>
              )}
            </div>
          )}
        </>
      )}
      <Message error={action.error} />
      <section className="section">
        <div className="section-heading">
          <h2>
            <ShieldCheck size={22} />
            Officer site access
          </h2>
          <Button variant="secondary" onClick={() => setGrant(true)}>
            Grant Access
          </Button>
        </div>
        <p className="muted">
          Access controls club records. Removing access preserves the member’s
          account and public board profile.
        </p>
        {access.isPending ? (
          <Loading />
        ) : access.error ? (
          <Failure error={access.error} retry={access.refetch} />
        ) : (
          <div className="stack">
            {access.data.items.map((officer) => (
              <Panel className="record-card" key={officer.member_id}>
                <div>
                  <h3>
                    {officer.name}
                    {officer.member_id === session?.member?.id && " (you)"}
                  </h3>
                  <small>{officer.email}</small>
                </div>
                <Button
                  variant="danger"
                  onClick={() => {
                    action.reset();
                    setRevoke(officer);
                  }}
                >
                  Revoke Access
                </Button>
              </Panel>
            ))}
          </div>
        )}
      </section>
      {edit && (
        <EntryDialog
          entry={edit.entry}
          term={edit.term}
          position={edit.position}
          terms={terms.data?.items || []}
          onClose={() => setEdit(null)}
        />
      )}
      {next && (
        <TermDialog
          onClose={() => setNext(false)}
          onCreated={setTermId}
          current={current}
        />
      )}
      {grant && (
        <PersonDialog
          title="Choose / Add Officer"
          onClose={() => setGrant(false)}
          onSelect={(person) => {
            void action
              .mutateAsync({
                url: "/api/admin/officers",
                body: { member_id: person.id },
              })
              .catch(() => {});
          }}
        />
      )}
      {revoke && (
        <Dialog
          title={`Revoke ${revoke.name}’s access?`}
          onClose={() => setRevoke(null)}
        >
          <p>
            Officer access ends immediately. Their public profile, member
            account, and history stay available. The last active officer cannot
            be removed.
          </p>
          {revoke.member_id === session?.member?.id && (
            <Message>You are removing your own officer access.</Message>
          )}
          <Message error={action.error} />
          <div className="form-actions">
            <Button variant="quiet" onClick={() => setRevoke(null)}>
              Keep Access
            </Button>
            <Button
              variant="danger"
              disabled={action.isPending}
              onClick={() => {
                void action
                  .mutateAsync({
                    url: `/api/admin/officers/${revoke.member_id}`,
                    method: "DELETE",
                  })
                  .then(() => setRevoke(null))
                  .catch(() => {});
              }}
            >
              Revoke Access
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
function TermDialog({
  current,
  onClose,
  onCreated,
}: {
  current?: Schema<"BoardTermView">;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const year = (current?.start_year || new Date().getFullYear() - 1) + 1;
  const form = useForm({
    defaultValues: { label: `${year}–${year + 1}`, start_year: year },
  });
  const action = useAction<Schema<"BoardTermView">>();
  return (
    <Dialog title="Start next board" onClose={onClose}>
      <p>
        The current board becomes a past year. Existing officer access is
        preserved until you explicitly revoke it.
      </p>
      <form
        onSubmit={form.handleSubmit(async (values) => {
          await action
            .mutateAsync({
              url: "/api/admin/board/terms",
              body: { ...values, start_year: Number(values.start_year) },
            })
            .then((term) => {
              onCreated(term.id);
              onClose();
            })
            .catch(() => {});
        })}
      >
        <Field
          label="Board year label"
          required
          maxLength={100}
          {...form.register("label")}
        />
        <Field
          label="Start year"
          required
          type="number"
          min={2000}
          max={2100}
          {...form.register("start_year")}
        />
        <Message error={action.error} />
        <div className="form-actions">
          <Button type="button" variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={action.isPending}>Start Board</Button>
        </div>
      </form>
    </Dialog>
  );
}
function EntryDialog({
  entry,
  term,
  position,
  terms,
  onClose,
}: {
  entry?: Entry;
  term: Term;
  position: number;
  terms: Term[];
  onClose: () => void;
}) {
  const form = useForm<Schema<"BoardEntryWrite">>({
    defaultValues: {
      member_id: entry?.member_id || null,
      name: entry?.name || "",
      role: entry?.role || "",
      major: entry?.major || "",
      bio: entry?.bio || "",
      memory: entry?.memory || "",
      instagram: entry?.instagram || "",
      photo_id: entry?.photo_id || null,
      palette: (entry?.palette ||
        "forest") as Schema<"BoardEntryWrite">["palette"],
      visible: entry?.visible ?? true,
      position: entry?.position ?? position,
      site_access: entry?.site_access || false,
      expected_revision: entry?.revision,
    },
  });
  const [link, setLink] = useState(false);
  const [chooseExisting, setChooseExisting] = useState(false);
  const [source, setSource] = useState<Entry | null>(null);
  const [linked, setLinked] = useState<Person | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [remove, setRemove] = useState(false);
  const action = useAction();
  return (
    <Dialog
      title={entry ? `Edit ${entry.name}` : "Add board profile"}
      onClose={onClose}
      wide
    >
      {!entry && (
        <div className="stack">
          <p>Adding to {term.label}</p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setChooseExisting(true)}
          >
            Use Existing Profile
          </Button>
          {source && (
            <p className="muted">
              Prefilled from {source.name}’s existing profile. Edit the details
              below.
            </p>
          )}
        </div>
      )}
      <form
        onSubmit={form.handleSubmit(async (body) => {
          await action
            .mutateAsync({
              url: entry
                ? `/api/admin/board/entries/${entry.id}`
                : `/api/admin/board/terms/${term.id}/entries`,
              method: entry ? "PUT" : "POST",
              body,
            })
            .then(onClose)
            .catch(() => {});
        })}
      >
        <div className="form-grid">
          <Field
            label="Name"
            required
            maxLength={100}
            {...form.register("name")}
          />
          <Field
            label="Officer role"
            required
            maxLength={100}
            {...form.register("role")}
          />
          <Field
            label="Major / year"
            maxLength={100}
            {...form.register("major")}
          />
          <Field
            label="Instagram profile URL"
            type="url"
            maxLength={300}
            placeholder="https://www.instagram.com/username/"
            {...form.register("instagram")}
          />
        </div>
        <label className="field">
          About them
          <textarea rows={4} maxLength={2000} {...form.register("bio")} />
        </label>
        <label className="field">
          Favorite AAC memory
          <textarea rows={3} maxLength={1000} {...form.register("memory")} />
        </label>
        <ImageUpload
          purpose="board"
          value={form.watch("photo_id")}
          onChange={(id) => form.setValue("photo_id", id)}
        />
        <fieldset className="section">
          <legend>Polaroid color</legend>
          <div className="palette-picker">
            {(
              ["forest", "rose", "sunset", "ocean", "sage", "lavender"] as const
            ).map((palette) => (
              <button
                type="button"
                aria-label={`${palette} palette`}
                key={palette}
                className={`palette ${palette}`}
                aria-pressed={form.watch("palette") === palette}
                onClick={() => form.setValue("palette", palette)}
              >
                {palette}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="check-field">
          <input type="checkbox" {...form.register("visible")} />
          Show on the public board
        </label>
        <Panel>
          <h3>Linked member & access</h3>
          <p>
            {linked?.name ||
              (form.watch("member_id")
                ? "An existing member is linked."
                : "No member linked.")}
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setLink(true)}
          >
            Choose Member
          </Button>
          <label className="check-field section">
            <input
              type="checkbox"
              checked={form.watch("site_access") || false}
              disabled={!form.watch("member_id")}
              onChange={(e) => {
                if (
                  !e.target.checked &&
                  (entry || source)?.site_access &&
                  form.getValues("member_id") === (entry || source)?.member_id
                )
                  setConfirmRevoke(true);
                else form.setValue("site_access", e.target.checked);
              }}
            />
            Grant officer site access
          </label>
          <small className="muted">
            Public profiles do not need site access. Changing the linked member
            does not revoke anyone else’s access.
          </small>
        </Panel>
        <Message error={action.error} />
        <div className="sticky-actions">
          <Button type="button" variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={action.isPending}>Save Profile</Button>
        </div>
        {entry && (
          <Button
            type="button"
            variant="danger"
            onClick={() => setRemove(true)}
          >
            Remove Public Profile
          </Button>
        )}
      </form>
      {chooseExisting && (
        <ExistingProfileDialog
          terms={terms.filter((t) => t.start_year < term.start_year)}
          onClose={() => setChooseExisting(false)}
          onSelect={(profile) => {
            const {
              id: _id,
              term_id: _termId,
              revision: _revision,
              ...fields
            } = profile;
            form.reset({
              ...fields,
              palette: profile.palette as Schema<"BoardEntryWrite">["palette"],
              position,
            });
            setSource(profile);
            setLinked(null);
            action.reset();
            setChooseExisting(false);
          }}
        />
      )}
      {link && (
        <PersonDialog
          title="Link a member"
          onClose={() => setLink(false)}
          onSelect={(person) => {
            setLinked(person);
            form.setValue("member_id", person.id);
            if (!entry) form.setValue("name", person.name);
            form.setValue("site_access", false);
          }}
        />
      )}
      {confirmRevoke && (
        <Dialog
          title="Remove site access when saving?"
          onClose={() => setConfirmRevoke(false)}
        >
          <p>
            The member’s public profile and history will remain. The last active
            officer cannot be removed.
          </p>
          <div className="form-actions">
            <Button variant="quiet" onClick={() => setConfirmRevoke(false)}>
              Keep Access
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                form.setValue("site_access", false);
                setConfirmRevoke(false);
              }}
            >
              Remove Access on Save
            </Button>
          </div>
        </Dialog>
      )}
      {remove && (
        <Dialog
          title="Remove this public profile?"
          onClose={() => setRemove(false)}
        >
          <p>
            The board profile will be removed. Member account and officer access
            are preserved.
          </p>
          <Message error={action.error} />
          <div className="form-actions">
            <Button variant="quiet" onClick={() => setRemove(false)}>
              Keep Profile
            </Button>
            <Button
              variant="danger"
              disabled={action.isPending}
              onClick={() => {
                void action
                  .mutateAsync({
                    url: `/api/admin/board/entries/${entry!.id}`,
                    method: "DELETE",
                  })
                  .then(onClose)
                  .catch(() => {});
              }}
            >
              Remove Profile
            </Button>
          </div>
        </Dialog>
      )}
    </Dialog>
  );
}

function ExistingProfileDialog({
  terms,
  onClose,
  onSelect,
}: {
  terms: Term[];
  onClose: () => void;
  onSelect: (entry: Entry) => void;
}) {
  const [termId, setTermId] = useState<number | undefined>(
    [...terms].sort((a, b) => b.start_year - a.start_year)[0]?.id,
  );
  const [entryId, setEntryId] = useState<number | null>(null);
  const board = useAPI("BoardPrivateView", `/api/admin/board/terms/${termId}`, {
    enabled: !!termId,
  });
  const profile = board.data?.entries.find((e) => e.id === entryId);
  return (
    <Dialog title="Use an existing board profile" onClose={onClose}>
      {!terms.length ? (
        <Empty title="No previous board years">
          Start with a blank profile for this board.
        </Empty>
      ) : (
        <div className="stack">
          <label className="field">
            Previous board year
            <select
              value={termId}
              onChange={(e) => {
                setTermId(Number(e.target.value));
                setEntryId(null);
              }}
            >
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          {board.isPending ? (
            <Loading />
          ) : board.error ? (
            <Failure error={board.error} retry={board.refetch} />
          ) : !board.data.entries.length ? (
            <Empty title="No profiles in this year">
              Choose another board year or start with a blank profile.
            </Empty>
          ) : (
            <label className="field">
              Existing board profile
              <select
                value={entryId || ""}
                onChange={(e) => setEntryId(Number(e.target.value) || null)}
              >
                <option value="">Choose a profile</option>
                {board.data.entries.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} · {e.role}
                    {e.visible ? "" : " · Hidden"}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="muted">
            Prefill the new profile, then edit and save it. The previous year’s
            profile stays unchanged.
          </p>
        </div>
      )}
      <div className="form-actions">
        <Button variant="quiet" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={!profile || !!board.error || board.isFetching}
          onClick={() => profile && onSelect(profile)}
        >
          Use Profile
        </Button>
      </div>
    </Dialog>
  );
}
