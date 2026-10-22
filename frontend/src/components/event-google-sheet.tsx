import { useState } from "react";
import { useSearchParams } from "react-router";
import { ArrowDown, ArrowUp, ExternalLink } from "lucide-react";
import { request, useAction, useAPI } from "../lib/api";
import type { Schema } from "../lib/api";
import {
  Button,
  Dialog,
  Failure,
  Field,
  Loading,
  Message,
  Panel,
  Pill,
} from "./ui";

const connectionURL = "/api/admin/integrations/google-sheets";
const statusLabels: Record<Schema<"EventSheetView">["status"], string> = {
  not_configured: "Not configured",
  provisioning: "Creating spreadsheet",
  pending: "Updates pending",
  synced: "Up to date",
  paused: "Paused",
  retrying: "Retrying",
  attention: "Action needed",
};
const connectionErrors: Record<string, string> = {
  connection_failed: "Google connection was not completed. Please try again.",
  missing_scope:
    "Allow access to the integration’s Google Drive files to enable syncing.",
  wrong_account:
    "Reconnect with the same club Google account that originally owned these spreadsheets.",
  offline_access:
    "Google did not provide offline access. Try connecting again and approve the requested access.",
};
const timestamp = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("en-US", {
        timeZone: "America/Los_Angeles",
        timeZoneName: "short",
      })
    : "Not yet";

export function SheetColumns({
  initial,
  busy,
  disabled,
  onSave,
}: {
  initial: Schema<"EventSheetView">;
  busy: boolean;
  disabled: boolean;
  onSave: (columns: Schema<"SheetColumn">[]) => void;
}) {
  const [columns, setColumns] = useState(initial.columns);
  function move(index: number, delta: number) {
    setColumns((old) => {
      const next = [...old];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave(columns);
      }}
    >
      <fieldset disabled={disabled || busy}>
        <legend>Choose columns</legend>
        <div className="sheet-column-choices">
          {initial.catalog.map((column) => (
            <label className="check-field" key={column.key}>
              <input
                type="checkbox"
                checked={columns.some((c) => c.key === column.key)}
                disabled={column.key === "status"}
                onChange={(event) =>
                  setColumns((old) =>
                    event.target.checked
                      ? [...old, column]
                      : old.filter((c) => c.key !== column.key),
                  )
                }
              />
              {column.header}
              {column.key === "status" && " (required)"}
            </label>
          ))}
        </div>
        <p className="muted">
          Cancelled signups stay in the sheet with their status. New custom
          questions must be selected here.
        </p>
        <h3>Column order and headings</h3>
        <div className="stack">
          {columns.map((column, index) => {
            const source =
              initial.catalog.find((c) => c.key === column.key)?.header ||
              column.key;
            return (
              <div className="sheet-column-row" key={column.key}>
                <Field
                  label={`Heading for ${source}`}
                  required
                  maxLength={200}
                  value={column.header}
                  onChange={(event) =>
                    setColumns((old) =>
                      old.map((c) =>
                        c.key === column.key
                          ? { ...c, header: event.target.value }
                          : c,
                      ),
                    )
                  }
                />
                <div className="actions">
                  <Button
                    type="button"
                    variant="quiet"
                    disabled={index === 0}
                    aria-label={`Move ${source} up`}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp size={18} />
                  </Button>
                  <Button
                    type="button"
                    variant="quiet"
                    disabled={index === columns.length - 1}
                    aria-label={`Move ${source} down`}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown size={18} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </fieldset>
      <h3>Preview</h3>
      <div
        className="sheet-preview"
        role="region"
        aria-label="Spreadsheet preview"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {initial.preview.length ? (
              initial.preview.map((row, index) => (
                <tr key={index}>
                  {columns.map((c) => (
                    <td key={c.key}>
                      {row[
                        initial.catalog.findIndex(
                          (source) => source.key === c.key,
                        )
                      ] || "—"}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length}>
                  Signup rows will appear here once members register.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Button disabled={disabled || busy} type="submit">
        {busy
          ? "Saving…"
          : initial.configured
            ? "Save column settings"
            : "Create spreadsheet"}
      </Button>
    </form>
  );
}

export function EventGoogleSheet({ eventId }: { eventId: number }) {
  const url = `/api/admin/events/${eventId}/google-sheet`;
  const query = useAPI("EventSheetView", url, { poll: true });
  const connection = useAPI("SheetsConnectionView", connectionURL, {
    poll: true,
  });
  const [params] = useSearchParams();
  const [disconnect, setDisconnect] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<Error | null>(null);
  const action = useAction();
  if (query.isPending || connection.isPending) return <Loading />;
  if (query.error) return <Failure error={query.error} retry={query.refetch} />;
  if (connection.error)
    return <Failure error={connection.error} retry={connection.refetch} />;
  const data = query.data;
  const account = connection.data;
  const disabled = !account.available || !account.connected;
  const oauthError = connectionErrors[params.get("sheets_error") || ""];
  async function connect() {
    setConnecting(true);
    setConnectionError(null);
    try {
      const result = await request<Schema<"SheetsConnectURL">>(
        connectionURL + "/connect",
        "POST",
        { event_id: eventId },
      );
      window.location.assign(result.url);
    } catch (error) {
      setConnectionError(error as Error);
      setConnecting(false);
    }
  }
  function save(
    columns: Schema<"SheetColumn">[],
    enabled = data.configured ? data.enabled : true,
  ) {
    action.mutate({
      url,
      method: "PUT",
      body: { columns, enabled, expected_revision: data.revision },
    });
  }
  return (
    <div className="stack">
      <Panel>
        <h2>Club Google account</h2>
        <p>
          Connect the club account once for all events. New spreadsheets belong
          to this account and are shared with current website officers.
        </p>
        {account.email && (
          <p>
            <strong>{account.email}</strong>
            {!account.connected && " · Disconnected"}
          </p>
        )}
        {!account.available ? (
          <Message>
            Google Sheets is not enabled yet. An administrator must configure
            the Google connection and sync worker.
          </Message>
        ) : (
          <div className="actions">
            <Button variant="secondary" disabled={connecting} onClick={connect}>
              {connecting
                ? "Connecting…"
                : account.email
                  ? "Reconnect club account"
                  : "Connect club Google account"}
            </Button>
            {account.connected && (
              <Button variant="quiet" onClick={() => setDisconnect(true)}>
                Disconnect club account
              </Button>
            )}
          </div>
        )}
        {oauthError && <Message>{oauthError}</Message>}
        {account.error && <Message>{account.error}</Message>}
        <Message error={connectionError} />
        {account.connected && !account.worker_healthy && (
          <Message>
            The sync worker has not checked in recently. Signups are saved;
            spreadsheet updates will wait until it is running.
          </Message>
        )}
      </Panel>
      <Panel>
        <div className="toolbar">
          <h2>Event spreadsheet</h2>
          <Pill tone={data.status === "synced" ? "green" : "yellow"}>
            {statusLabels[data.status]}
          </Pill>
        </div>
        <p>
          Updates normally arrive within one minute. Existing signups are
          included automatically. Use the Notes tab or other tabs for manual
          work; the website manages the protected Signups tab.
        </p>
        {data.configured && (
          <>
            <p>Last synced: {timestamp(data.last_synced_at)}</p>
            {data.pending_since && data.enabled && (
              <p>Updates pending since {timestamp(data.pending_since)}</p>
            )}
            <div className="actions">
              {data.spreadsheet_url && (
                <a
                  className="button secondary"
                  href={data.spreadsheet_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open spreadsheet <ExternalLink size={16} />
                </a>
              )}
              <Button
                variant="secondary"
                disabled={disabled || action.isPending || !data.enabled}
                onClick={() =>
                  action.mutate({
                    url: url + "/sync",
                    body: { expected_revision: data.revision },
                  })
                }
              >
                Sync now
              </Button>
              <Button
                variant="quiet"
                disabled={disabled || action.isPending}
                onClick={() => save(data.columns, !data.enabled)}
              >
                {data.enabled ? "Pause sync" : "Resume sync"}
              </Button>
            </div>
            {data.sharing_pending && (
              <p className="muted">Officer access updates are pending.</p>
            )}
            {data.error && <Message>{data.error}</Message>}
            {data.sharing_error && (
              <Message>Officer access: {data.sharing_error}</Message>
            )}
          </>
        )}
        <Message error={action.error} />
        <SheetColumns
          key={`${eventId}:${data.revision}`}
          initial={data}
          busy={action.isPending}
          disabled={disabled}
          onSave={(columns) => save(columns)}
        />
      </Panel>
      {disconnect && (
        <Dialog
          title="Disconnect the club Google account?"
          onClose={() => setDisconnect(false)}
        >
          <p>
            This stops Google Sheets updates for every event and removes the
            stored credential. Existing spreadsheets and Google sharing
            permissions remain in place. Reconnect the same club account to
            resume.
          </p>
          <Message error={action.error} />
          <div className="actions">
            <Button
              variant="danger"
              disabled={action.isPending}
              onClick={() =>
                action.mutate(
                  {
                    url: connectionURL,
                    method: "DELETE",
                  },
                  { onSuccess: () => setDisconnect(false) },
                )
              }
            >
              Disconnect all events
            </Button>
            <Button variant="quiet" onClick={() => setDisconnect(false)}>
              Keep connected
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
