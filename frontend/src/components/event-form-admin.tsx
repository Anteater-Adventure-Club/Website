import { useState } from "react";
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Pencil,
  Plus,
  Check,
  ExternalLink,
} from "lucide-react";
import {
  useAPI,
  useAction,
  fromPacific,
  pacificInput,
  type AdminEvent,
  type Schema,
} from "../lib/api";
import {
  formAPI,
  formTime,
  formURL,
  phaseLabels,
  responseLabels,
  responseTone,
  type EventForm,
} from "../lib/event-forms";
import {
  FormAnswers,
  FormQuestions,
  QuestionEditor,
  visibleQuestions,
  type FormAnswersValue,
} from "./form-questions";
import { FormTemplatePicker } from "./form-templates";
import { SheetColumns } from "./event-google-sheet";
import { SwipeTable } from "./swipe-table";
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
} from "./ui";

export function EventFormEditor({
  event,
  initial,
  onClose,
}: {
  event: Pick<AdminEvent, "id" | "starts_at">;
  initial?: EventForm;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initial?.title || "");
  const [instructions, setInstructions] = useState(initial?.instructions || "");
  const [questions, setQuestions] = useState<Schema<"Question">[]>(
    initial?.questions || [],
  );
  const [required, setRequired] = useState(initial?.required || false);
  const [late, setLate] = useState(initial?.allow_late || false);
  const [opens, setOpens] = useState(
    pacificInput(initial?.opens_at || new Date().toISOString()),
  );
  const [closes, setCloses] = useState(
    pacificInput(
      initial?.closes_at ||
        (new Date(event.starts_at).getTime() > Date.now()
          ? event.starts_at
          : new Date(Date.now() + 86400000).toISOString()),
    ),
  );
  const [localError, setLocalError] = useState<Error | null>(null);
  const action = useAction<EventForm>();
  const navigate = useNavigate();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setLocalError(null);
        const state =
          (e.nativeEvent as SubmitEvent).submitter?.getAttribute(
            "data-state",
          ) ||
          initial?.state ||
          "draft";
        try {
          const body = {
            title,
            instructions,
            questions,
            required,
            allow_late: late,
            opens_at: fromPacific(opens),
            closes_at: fromPacific(closes),
            state,
            expected_revision: initial?.revision,
          };
          void action
            .mutateAsync({
              url: initial
                ? formAPI(initial, true)
                : `/api/admin/events/${event.id}/forms`,
              method: initial ? "PUT" : "POST",
              body,
            })
            .then((saved) => {
              onClose();
              navigate(formURL(saved, true));
            })
            .catch(() => {});
        } catch (error) {
          setLocalError(error as Error);
        }
      }}
    >
      {!initial?.questions_locked && (
        <FormTemplatePicker
          kind="followup"
          questions={questions}
          onSelect={(t) => {
            if (!t) return;
            setTitle(t.title);
            setInstructions(t.instructions);
            setQuestions(t.questions);
            setRequired(t.required);
            setLate(t.allow_late);
          }}
        />
      )}
      <Field
        label="Form title"
        required
        maxLength={150}
        placeholder="e.g. Yosemite gear check"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Field label="Instructions">
        <textarea
          aria-label="Instructions"
          rows={3}
          maxLength={5000}
          placeholder="Let members know what you need before the trip."
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
      </Field>
      <div className="form-grid">
        <Field
          label="Opens · Pacific"
          type="datetime-local"
          required
          value={opens}
          onChange={(e) => setOpens(e.target.value)}
        />
        <Field
          label="Closes · Pacific"
          type="datetime-local"
          required
          value={closes}
          onChange={(e) => setCloses(e.target.value)}
        />
      </div>
      <label className="check-field">
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
        />
        Required for event participants
      </label>
      <p className="muted">
        Missing required responses are flagged after the deadline. Officers
        decide whether to cancel a signup.
      </p>
      <Field
        label="Allow Late Submissions?"
        hint="Yes allows a first response after the deadline. Changes to submitted answers stop at closing time."
      >
        <select
          aria-label="Allow Late Submissions?"
          value={late ? "yes" : "no"}
          onChange={(e) => setLate(e.target.value === "yes")}
        >
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>
      </Field>
      {initial?.questions_locked && (
        <Message>
          Questions are locked because this form has responses. You can still
          change its schedule and settings.
        </Message>
      )}
      <fieldset
        className="form-questions-editor"
        disabled={initial?.questions_locked}
      >
        <legend>Questions</legend>
        <QuestionEditor questions={questions} onChange={setQuestions} />
      </fieldset>
      <Message error={localError || action.error} />
      <div className="sticky-actions form-actions">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        {(!initial || initial.state === "draft") && (
          <Button
            variant="secondary"
            data-state="draft"
            disabled={action.isPending || !questions.length}
          >
            Save draft
          </Button>
        )}
        <Button
          data-state={initial?.state === "archived" ? "archived" : "published"}
          disabled={action.isPending || !questions.length}
        >
          {!initial || initial.state === "draft"
            ? "Publish form"
            : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

export function EventFormCards({ forms }: { forms: EventForm[] }) {
  return (
    <div className="event-form-grid">
      {forms.map((f) => (
        <Panel className="event-form-card" key={f.id}>
          <div className="actions">
            <Pill
              tone={
                f.phase === "open" || f.phase === "late" ? "yellow" : "green"
              }
            >
              {phaseLabels[f.phase]}
            </Pill>
            {f.required && <small>Required</small>}
          </div>
          <h3>
            <Link to={formURL(f, true)}>{f.title}</Link>
          </h3>
          <p className="muted">{f.event_name}</p>
          <p className="form-card-date">
            {f.phase === "scheduled"
              ? `Opens ${formTime(f.opens_at)}`
              : `Due ${formTime(f.closes_at)}`}
          </p>
          <div className="form-card-counts">
            <span>
              <strong>
                {f.response_count}/{f.participant_count}
              </strong>{" "}
              responses
            </span>
            {f.no_response_count > 0 && (
              <Pill tone="yellow">{f.no_response_count} No Response</Pill>
            )}
          </div>
          <Link className="text-link" to={formURL(f, true)}>
            Manage form <ArrowRight size={16} />
          </Link>
        </Panel>
      ))}
    </div>
  );
}

export function EventFormsTab({ event }: { event: AdminEvent }) {
  const query = useAPI(
    "Items_EventFormView_",
    `/api/admin/events/${event.id}/forms`,
  );
  const [create, setCreate] = useState(false);
  const quarters = useAPI("Page_QuarterPrivate_", "/api/admin/quarters");
  const editable =
    event.state !== "cancelled" &&
    quarters.data?.items.find((q) => q.id === event.quarter_id)?.state ===
      "open";
  return (
    <>
      <div className="toolbar">
        <div>
          <h2>Follow-up forms</h2>
          <p className="muted">
            Confirm plans, check gear, and get everyone ready.
          </p>
        </div>
        <Button disabled={!editable} onClick={() => setCreate(true)}>
          <Plus size={18} />
          New form
        </Button>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <Failure error={query.error} retry={query.refetch} />
      ) : query.data.items.length ? (
        <EventFormCards forms={query.data.items} />
      ) : (
        <Empty title="Get ready for the adventure">
          Create a follow-up form for people signed up for this event.
        </Empty>
      )}
      {create && (
        <Dialog title="New event form" wide onClose={() => setCreate(false)}>
          <EventFormEditor event={event} onClose={() => setCreate(false)} />
        </Dialog>
      )}
    </>
  );
}

function FormSheet({ form }: { form: EventForm }) {
  const url = formAPI(form, true) + "/google-sheet";
  const query = useAPI("EventFormSheetView", url);
  const action = useAction();
  if (query.isPending) return <Loading />;
  if (query.error) return <Failure error={query.error} retry={query.refetch} />;
  const data = query.data;
  return (
    <Panel>
      <h2>Sync responses to Google Sheets</h2>
      <p>
        This form gets its own protected tab in the event spreadsheet, alongside
        Signups. Missing responses and cancelled signups are included.
      </p>
      <Link
        className="text-link"
        to={`/admin/events/${form.event_slug}/${form.event_id}?tab=google-sheets`}
      >
        Event spreadsheet settings <ArrowRight size={16} />
      </Link>
      {!data.workbook_configured ? (
        <Message>
          Set up the event spreadsheet first, then choose which response columns
          to sync here.
        </Message>
      ) : (
        <>
          <div className="toolbar section">
            <Pill tone={data.enabled ? "green" : "yellow"}>
              {data.enabled ? "Sync enabled" : "Sync off"}
            </Pill>
            {data.spreadsheet_url && (
              <a
                className="button secondary"
                href={data.spreadsheet_url}
                target="_blank"
                rel="noreferrer"
              >
                Open form tab <ExternalLink size={16} />
              </a>
            )}
            {data.enabled && (
              <Button
                variant="secondary"
                disabled={action.isPending}
                onClick={() =>
                  action.mutate({
                    url,
                    method: "PUT",
                    body: {
                      columns: data.columns,
                      enabled: false,
                      expected_revision: data.revision,
                    },
                  })
                }
              >
                Pause this form
              </Button>
            )}
          </div>
          <SheetColumns
            key={`${data.revision}:${data.enabled}`}
            initial={data}
            saveLabel={
              data.enabled ? "Save column settings" : "Enable form sync"
            }
            requiredKeys={["status", "response_status"]}
            busy={action.isPending}
            disabled={false}
            onSave={(columns) =>
              action.mutate({
                url,
                method: "PUT",
                body: {
                  columns,
                  enabled: true,
                  expected_revision: data.revision,
                },
              })
            }
          />
        </>
      )}
      <Message error={action.error} />
    </Panel>
  );
}

function ResponseAnswer({
  question,
  response,
}: {
  question: Schema<"Question">;
  response: Schema<"FormResponseView"> | null;
}) {
  if (!response) return <span className="muted">—</span>;
  const recorded = response.questions.find((q) => q.id === question.id);
  if (!recorded) return <span className="muted">Not asked</span>;
  if (
    !visibleQuestions(response.questions, response.answers).some(
      (q) => q.id === question.id,
    )
  )
    return <span className="muted">Not applicable</span>;
  const answer = response.answers[question.id];
  if (!answer?.length) return <span className="muted">Not provided</span>;
  return (
    <>
      {Array.isArray(answer)
        ? answer.join("\n")
        : recorded.kind === "yes-no"
          ? answer === "yes"
            ? "Yes"
            : "No"
          : answer}
    </>
  );
}

function FormResponses({ form }: { form: EventForm }) {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [detail, setDetail] = useState<Schema<"EventFormResponseRow"> | null>(
    null,
  );
  const [remove, setRemove] = useState<Schema<"EventFormResponseRow"> | null>(
    null,
  );
  const query = useAPI(
    "Page_EventFormResponseRow_",
    `${formAPI(form, true)}/responses?limit=50&offset=${offset}&status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`,
  );
  const action = useAction();
  const hasCancellations = query.data?.items.some(
    (row) => row.status === "no_response" && row.can_cancel,
  );
  return (
    <>
      <h2 className="sr-only">Responses</h2>
      <SwipeTable
        toolbar={
          <div className="response-filters">
            <input
              aria-label="Search responses"
              placeholder="Search name or email"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOffset(0);
              }}
            />
            <select
              aria-label="Response status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setOffset(0);
              }}
            >
              <option value="">All responses</option>
              {Object.entries(responseLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        }
      >
        {query.isPending ? (
          <Loading />
        ) : query.error ? (
          <Failure error={query.error} retry={query.refetch} />
        ) : query.data.items.length ? (
          <table className="record-table response-grid">
            <thead>
              <tr>
                <th scope="col" className="response-member-cell">
                  Member
                </th>
                <th scope="col" className="response-status-cell">
                  Response
                </th>
                {form.questions.map((question) => (
                  <th
                    scope="col"
                    className="response-answer-cell"
                    key={question.id}
                  >
                    {question.label}
                  </th>
                ))}
                <th scope="col" className="response-time-cell">
                  Submitted
                </th>
                <th
                  scope="col"
                  className={
                    hasCancellations
                      ? "response-actions-cell"
                      : "response-mobile-only"
                  }
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((r) => (
                <tr key={r.signup_id}>
                  <td data-label="Member" className="response-member-cell">
                    <div>
                      <strong>{r.name}</strong>
                      <small>{r.email}</small>
                    </div>
                  </td>
                  <td data-label="Response" className="response-status-cell">
                    <Pill tone={responseTone(r.status)}>
                      {responseLabels[r.status]}
                    </Pill>
                  </td>
                  {form.questions.map((question) => (
                    <td
                      className="response-answer-cell"
                      key={question.id}
                      data-label={question.label}
                    >
                      <ResponseAnswer
                        question={question}
                        response={r.response}
                      />
                    </td>
                  ))}
                  <td data-label="Submitted" className="response-time-cell">
                    {r.response ? formTime(r.response.submitted_at) : "—"}
                  </td>
                  <td
                    data-label="Actions"
                    className={
                      hasCancellations
                        ? "response-actions-cell"
                        : "response-mobile-only"
                    }
                  >
                    <div className="actions">
                      {r.response && (
                        <Button
                          variant="quiet"
                          className="response-mobile-only"
                          onClick={() => setDetail(r)}
                        >
                          View answers
                        </Button>
                      )}
                      {r.status === "no_response" && r.can_cancel && (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            action.reset();
                            setRemove(r);
                          }}
                        >
                          Cancel signup
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty title="No matching responses">
            Try another status or search.
          </Empty>
        )}
      </SwipeTable>
      {query.data && (
        <div className="toolbar section">
          <small>{query.data.total} participants</small>
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
              disabled={offset + 50 >= query.data.total}
              onClick={() => setOffset(offset + 50)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
      {detail?.response && (
        <Dialog
          title={`${detail.name} · ${form.title}`}
          wide
          onClose={() => setDetail(null)}
        >
          <FormAnswers
            questions={detail.response.questions}
            answers={detail.response.answers}
          />
          <Button variant="secondary" onClick={() => setDetail(null)}>
            Close
          </Button>
        </Dialog>
      )}
      {remove && (
        <Dialog title="Cancel this signup?" onClose={() => setRemove(null)}>
          <p>
            {remove.name} has not responded to {form.title}. Cancelling removes
            their place in the event and keeps their signup history.
          </p>
          <Message error={action.error} />
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setRemove(null)}>
              Keep signup
            </Button>
            <Button
              variant="danger"
              disabled={action.isPending}
              onClick={() => {
                void action
                  .mutateAsync({
                    url: `/api/admin/signups/${remove.signup_id}`,
                    method: "DELETE",
                  })
                  .then(() => setRemove(null))
                  .catch(() => {});
              }}
            >
              Cancel signup
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}

export function AdminEventFormPage() {
  const { id, number, slug } = useParams();
  const [params, setParams] = useSearchParams();
  const query = useAPI(
    "EventFormView",
    `/api/admin/events/${id}/forms/${number}`,
  );
  const event = useAPI("EventPrivate", `/api/admin/events/${id}`);
  const [editing, setEditing] = useState(false);
  const [archive, setArchive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<Error | null>(null);
  const action = useAction();
  if (query.isPending || event.isPending) return <Loading />;
  if (query.error || event.error)
    return (
      <Failure error={(query.error || event.error)!} retry={query.refetch} />
    );
  const form = query.data;
  if (slug !== form.event_slug)
    return <Navigate replace to={formURL(form, true)} />;
  const tab = ["responses", "preview", "google-sheets"].includes(
    params.get("tab") || "",
  )
    ? params.get("tab")!
    : "responses";
  return (
    <>
      <Link
        className="text-link"
        to={`/admin/events/${form.event_slug}/${form.event_id}?tab=forms`}
      >
        <ArrowLeft size={16} />
        {form.event_name}
      </Link>
      <PageHeading
        title={form.title}
        subtitle={`${form.required ? "Required" : "Optional"} · Due ${formTime(form.closes_at)}`}
      >
        <Pill
          tone={
            form.phase === "open" || form.phase === "late" ? "yellow" : "green"
          }
        >
          {phaseLabels[form.phase]}
        </Pill>
        <Button
          variant="secondary"
          onClick={() => {
            void navigator.clipboard
              .writeText(window.location.origin + formURL(form))
              .then(() => {
                setCopied(true);
                setCopyError(null);
              })
              .catch(() =>
                setCopyError(
                  new Error(
                    "Copy this link: " + window.location.origin + formURL(form),
                  ),
                ),
              );
          }}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? "Link copied" : "Copy form link"}
        </Button>
        <Button disabled={!form.editable} onClick={() => setEditing(true)}>
          <Pencil size={16} />
          Edit form
        </Button>
      </PageHeading>
      <Message error={copyError} />
      <div className="form-summary-grid">
        <Panel>
          <strong>
            {form.response_count}
            <span> / {form.participant_count}</span>
          </strong>
          <p>Responses received</p>
        </Panel>
        <Panel>
          <strong>{form.no_response_count}</strong>
          <p>No Response</p>
        </Panel>
        <Panel>
          <strong>{form.allow_late ? "Yes" : "No"}</strong>
          <p>Late submissions allowed</p>
        </Panel>
      </div>
      <div className="event-form-nav">
        <nav className="tabs" aria-label="Form management tabs">
          {[
            ["responses", "Responses"],
            ["preview", "Preview"],
            ["google-sheets", "Google Sheets"],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-current={tab === value ? "page" : undefined}
              onClick={() => setParams({ tab: value })}
            >
              {label}
            </button>
          ))}
        </nav>
        <Button
          variant="quiet"
          disabled={!form.editable}
          onClick={() => {
            action.reset();
            setArchive(true);
          }}
        >
          {form.state === "archived" ? "Restore form" : "Archive form"}
        </Button>
      </div>
      <section className="event-form-content">
        {tab === "responses" ? (
          <FormResponses form={form} />
        ) : tab === "google-sheets" ? (
          <FormSheet form={form} />
        ) : (
          <Panel className="event-form-preview">
            <p className="muted">Participant preview</p>
            <h2>{form.title}</h2>
            <p className="preserve-lines">{form.instructions}</p>
            <PreviewQuestions form={form} />
          </Panel>
        )}
      </section>
      {editing && (
        <Dialog title="Edit event form" wide onClose={() => setEditing(false)}>
          <EventFormEditor
            event={event.data}
            initial={form}
            onClose={() => setEditing(false)}
          />
        </Dialog>
      )}
      {archive && (
        <Dialog
          title={
            form.state === "archived"
              ? "Restore this form?"
              : "Archive this form?"
          }
          onClose={() => setArchive(false)}
        >
          <p>
            {form.state === "archived"
              ? "The form will follow its saved dates and submission settings again."
              : "Stop collecting responses and remove reminders. Existing responses stay available to officers."}
          </p>
          <Message error={action.error} />
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setArchive(false)}>
              Cancel
            </Button>
            <Button
              disabled={action.isPending}
              onClick={() => {
                const {
                  title,
                  instructions,
                  questions,
                  opens_at,
                  closes_at,
                  required,
                  allow_late,
                } = form;
                void action
                  .mutateAsync({
                    url: formAPI(form, true),
                    method: "PUT",
                    body: {
                      title,
                      instructions,
                      questions,
                      opens_at,
                      closes_at,
                      required,
                      allow_late,
                      expected_revision: form.revision,
                      state:
                        form.state === "archived" ? "published" : "archived",
                    },
                  })
                  .then(() => setArchive(false))
                  .catch(() => {});
              }}
            >
              {form.state === "archived" ? "Restore form" : "Archive form"}
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}

function PreviewQuestions({ form }: { form: EventForm }) {
  const [answers, setAnswers] = useState<FormAnswersValue>({});
  return (
    <>
      <FormQuestions
        questions={form.questions}
        answers={answers}
        onChange={setAnswers}
      />
      <p className="muted">
        Preview only. Answers entered here are not submitted.
      </p>
    </>
  );
}
