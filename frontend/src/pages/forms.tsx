import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Plus } from "lucide-react";
import { useAPI } from "../lib/api";
import { useQuarter } from "../lib/context";
import { ApplicationSettings } from "../components/application";
import {
  EventFormCards,
  EventFormEditor,
} from "../components/event-form-admin";
import { FormTemplateManager } from "../components/form-templates";
import {
  Button,
  Dialog,
  Empty,
  Failure,
  Field,
  Loading,
  PageHeading,
} from "../components/ui";

export function Forms() {
  const { quarter } = useQuarter();
  const [params, setParams] = useSearchParams();
  const tab = ["events", "templates", "application"].includes(
    params.get("tab") || "",
  )
    ? params.get("tab")!
    : "events";
  const [offset, setOffset] = useState(0);
  const [create, setCreate] = useState(false);
  const [eventId, setEventId] = useState("");
  const forms = useAPI(
    "Page_EventFormView_",
    `/api/admin/event-forms?limit=50&offset=${offset}${quarter ? `&quarter_id=${quarter.id}` : ""}`,
    { enabled: tab === "events" },
  );
  const events = useAPI(
    "Page_EventPrivate_",
    `/api/admin/events?limit=200${quarter ? `&quarter_id=${quarter.id}` : ""}`,
    { enabled: create },
  );
  const selected = events.data?.items.find((e) => String(e.id) === eventId);
  return (
    <>
      <PageHeading
        title="Forms"
        subtitle="Ask good questions. Get ready for the next adventure."
      >
        {tab === "events" && (
          <Button
            onClick={() => {
              setEventId("");
              setCreate(true);
            }}
          >
            <Plus size={18} />
            New event form
          </Button>
        )}
      </PageHeading>
      <nav className="tabs" aria-label="Forms tabs">
        {[
          ["events", "Event forms"],
          ["templates", "Templates"],
          ["application", "External application"],
        ].map(([value, label]) => (
          <button
            key={value}
            aria-current={tab === value ? "page" : undefined}
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set("tab", value);
              setParams(next);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="section">
        {tab === "templates" ? (
          <FormTemplateManager />
        ) : tab === "application" ? (
          <>
            <ApplicationSettings />
            <p className="muted">
              Review submitted applications in{" "}
              <Link className="inline-link" to="/admin/members?status=pending">
                Members → Pending
              </Link>
              .
            </p>
          </>
        ) : forms.isPending ? (
          <Loading />
        ) : forms.error ? (
          <Failure error={forms.error} retry={forms.refetch} />
        ) : (
          <>
            {forms.data.items.length ? (
              <EventFormCards forms={forms.data.items} />
            ) : (
              <Empty title="A little planning goes a long way">
                Create a confirmation or gear-check form for your next event.
                Only signed-up participants can respond.
              </Empty>
            )}
            {forms.data.total > 50 && (
              <div className="toolbar section">
                <small>{forms.data.total} forms</small>
                <div className="actions">
                  <Button
                    variant="secondary"
                    disabled={!offset}
                    onClick={() => setOffset(offset - 50)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={offset + 50 >= forms.data.total}
                    onClick={() => setOffset(offset + 50)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {create && (
        <Dialog title="New event form" wide onClose={() => setCreate(false)}>
          {events.isPending ? (
            <Loading />
          ) : events.error ? (
            <Failure error={events.error} retry={events.refetch} />
          ) : (
            <>
              <Field label="Event">
                <select
                  aria-label="Event"
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                >
                  <option value="">Choose an event…</option>
                  {events.data.items
                    .filter((e) => e.signups_enabled && e.state !== "cancelled")
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                </select>
              </Field>
              {selected && (
                <EventFormEditor
                  key={selected.id}
                  event={selected}
                  onClose={() => setCreate(false)}
                />
              )}
            </>
          )}
        </Dialog>
      )}
    </>
  );
}
