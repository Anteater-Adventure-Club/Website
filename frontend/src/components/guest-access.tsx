import { useState } from "react";
import {
  dateLabel,
  fromPacific,
  pacificInput,
  useAction,
  useAPI,
} from "../lib/api";
import type { Person, Schema } from "../lib/api";
import { permissionDescriptions, permissionLabels } from "../lib/access";
import type { Permission } from "../lib/access";
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
} from "./ui";
import { PersonDialog } from "./officer-forms";

type Grant = Schema<"GuestOfficerView">;
export function GuestAccess() {
  const query = useAPI("Items_GuestOfficerView_", "/api/admin/guest-officers", {
    poll: true,
  });
  const [choosing, setChoosing] = useState(false);
  const [editing, setEditing] = useState<{
    member: Pick<Person, "id" | "name">;
    grant?: Grant;
  }>();
  const [revoking, setRevoking] = useState<Grant>();
  const action = useAction();
  return (
    <section className="section">
      <div className="section-heading">
        <h2>Guest officer access</h2>
        <Button onClick={() => setChoosing(true)}>Grant Guest Access</Button>
      </div>
      <p className="muted">
        Temporary, club-wide permissions for approved members. Guests can use
        only the tools selected for them.
      </p>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <Failure error={query.error} retry={query.refetch} />
      ) : (
        <div className="stack">
          {query.data.items.map((grant) => (
            <Panel className="record-card" key={grant.member_id}>
              <div>
                <h3>
                  {grant.name}{" "}
                  <Pill tone={grant.active ? "green" : "gray"}>
                    {grant.active ? "Active" : "Expired / inactive"}
                  </Pill>
                </h3>
                <p>{grant.email}</p>
                <p>
                  {grant.permissions
                    .map((p) => permissionLabels[p])
                    .join(" · ")}
                </p>
                <small>
                  Expires{" "}
                  {dateLabel(grant.expires_at, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}{" "}
                  Pacific · Granted by officer #{grant.granted_by}
                </small>
              </div>
              <div className="actions">
                <Button
                  variant="secondary"
                  onClick={() =>
                    setEditing({
                      member: { id: grant.member_id, name: grant.name },
                      grant,
                    })
                  }
                >
                  {grant.active ? "Edit Access" : "Renew Access"}
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    action.reset();
                    setRevoking(grant);
                  }}
                >
                  Revoke Guest Access
                </Button>
              </div>
            </Panel>
          ))}
          {!query.data.items.length && (
            <Empty title="No Guest officers">
              Grant temporary access to a member helping with club work.
            </Empty>
          )}
        </div>
      )}
      {choosing && (
        <PersonDialog
          title="Choose Guest officer"
          selectOnly
          onClose={() => setChoosing(false)}
          onSelect={(member) => setEditing({ member })}
        />
      )}
      {editing && (
        <GuestEditor {...editing} onClose={() => setEditing(undefined)} />
      )}
      {revoking && (
        <Dialog
          title={`Revoke ${revoking.name}’s Guest access?`}
          onClose={() => setRevoking(undefined)}
        >
          <p>
            Their officer tools will become unavailable immediately. Their
            member account stays available.
          </p>
          <Message error={action.error} />
          <div className="form-actions">
            <Button variant="quiet" onClick={() => setRevoking(undefined)}>
              Keep Access
            </Button>
            <Button
              variant="danger"
              disabled={action.isPending}
              onClick={() => {
                void action
                  .mutateAsync({
                    url: `/api/admin/guest-officers/${revoking.member_id}`,
                    method: "DELETE",
                  })
                  .then(() => setRevoking(undefined))
                  .catch(() => {});
              }}
            >
              Revoke Access
            </Button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
function GuestEditor({
  member,
  grant,
  onClose,
}: {
  member: Pick<Person, "id" | "name">;
  grant?: Grant;
  onClose: () => void;
}) {
  const [permissions, setPermissions] = useState<Permission[]>(
    grant?.permissions || [],
  );
  const [expiry, setExpiry] = useState(
    pacificInput(
      grant?.active
        ? grant.expires_at
        : new Date(Date.now() + 7 * 86400000).toISOString(),
    ),
  );
  const [error, setError] = useState<Error | null>(null);
  const action = useAction();
  return (
    <Dialog
      title={`${grant ? "Edit" : "Grant"} Guest access · ${member.name}`}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          try {
            const expires_at = fromPacific(expiry);
            if (!expires_at || new Date(expires_at).getTime() <= Date.now())
              throw new Error("Choose an expiry in the future.");
            void action
              .mutateAsync({
                url: `/api/admin/guest-officers${grant ? `/${grant.member_id}` : ""}`,
                method: grant ? "PUT" : "POST",
                body: {
                  permissions,
                  expires_at,
                  ...(grant
                    ? { expected_revision: grant.revision }
                    : { member_id: member.id }),
                },
              })
              .then(onClose)
              .catch(() => {});
          } catch (err) {
            setError(err as Error);
          }
        }}
      >
        <fieldset>
          <legend>Permissions</legend>
          {(Object.keys(permissionLabels) as Permission[]).map((p) => (
            <label className="check-field" key={p}>
              <input
                type="checkbox"
                aria-label={permissionLabels[p]}
                aria-describedby={`guest-permission-${p}`}
                checked={permissions.includes(p)}
                onChange={(e) =>
                  setPermissions(
                    e.target.checked
                      ? [...permissions, p]
                      : permissions.filter((v) => v !== p),
                  )
                }
              />
              <span>
                {permissionLabels[p]}
                <small
                  id={`guest-permission-${p}`}
                  className="muted"
                  style={{ display: "block" }}
                >
                  {permissionDescriptions[p]}
                </small>
              </span>
            </label>
          ))}
        </fieldset>
        <Field
          label="Access expires · Pacific"
          type="datetime-local"
          required
          value={expiry}
          onChange={(e) => setExpiry(e.target.value)}
        />
        <Message error={error || action.error} />
        <div className="form-actions">
          <Button type="button" variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!permissions.length || action.isPending}>
            Save Guest Access
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
