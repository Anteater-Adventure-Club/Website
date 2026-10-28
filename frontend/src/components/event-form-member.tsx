import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, ClipboardList, Check } from "lucide-react";
import { useIdentity } from "../lib/context";
import { needsApproval } from "../lib/approval";
import { request, useAPI, useAction, type Schema } from "../lib/api";
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
  cleanAnswers,
  compatibleAnswers,
  FormAnswers,
  FormQuestions,
  type FormAnswersValue,
} from "./form-questions";
import { Button, Failure, Loading, Message, Panel, Pill } from "./ui";

export function FormAttentionBanner() {
  const { session } = useIdentity();
  const location = useLocation();
  const enabled = !!session?.member && !needsApproval(session.member);
  const query = useQuery<Schema<"Items_EventFormView_">>({
    queryKey: ["Items_EventFormView_", "/api/me/event-forms/attention"],
    queryFn: ({ signal }) =>
      request("/api/me/event-forms/attention", "GET", undefined, signal),
    enabled,
    staleTime: 20000,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
  useEffect(() => {
    if (enabled) void query.refetch();
  }, [enabled, location.pathname, query.refetch]);
  const forms = enabled ? query.data?.items || [] : [];
  if (!forms.length) return null;
  return (
    <aside className="form-attention" aria-label="Forms needing your attention">
      <div className="form-attention-inner">
        <ClipboardList size={23} aria-hidden="true" />
        <div>
          <strong>
            {forms.length === 1
              ? "A form needs your attention"
              : `${forms.length} forms need your attention`}
          </strong>
          {forms.length === 1 ? (
            <p>
              {forms[0].event_name} · {forms[0].title} ·{" "}
              {forms[0].phase === "late"
                ? "Overdue — late submissions welcome"
                : `Due ${formTime(forms[0].closes_at)}`}
            </p>
          ) : (
            <details>
              <summary>View required forms</summary>
              <ul>
                {forms.map((f) => (
                  <li key={f.id}>
                    <Link to={formURL(f)}>
                      {f.event_name} · {f.title}
                    </Link>{" "}
                    <span>
                      —{" "}
                      {f.phase === "late"
                        ? "Overdue"
                        : `due ${formTime(f.closes_at)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
        {forms.length === 1 && (
          <Link className="button secondary small" to={formURL(forms[0])}>
            Complete form <ArrowRight size={16} />
          </Link>
        )}
      </div>
    </aside>
  );
}

export function MemberEventForms({ eventId }: { eventId: number }) {
  const query = useAPI("Items_EventFormView_", `/api/events/${eventId}/forms`);
  if (query.isPending) return <Loading />;
  if (query.error) return <Failure error={query.error} retry={query.refetch} />;
  if (!query.data.items.length) return null;
  return (
    <section className="section">
      <h2>Event forms</h2>
      <div className="stack">
        {query.data.items.map((f) => (
          <Panel className="event-form-card" key={f.id}>
            <div className="actions">
              <Pill tone={f.status ? responseTone(f.status) : "green"}>
                {f.status ? responseLabels[f.status] : phaseLabels[f.phase]}
              </Pill>
              {f.required && <small>Required</small>}
            </div>
            <h3>{f.title}</h3>
            <p className="muted">
              {f.phase === "scheduled"
                ? `Opens ${formTime(f.opens_at)}`
                : `Due ${formTime(f.closes_at)}`}
            </p>
            <Link className="button secondary" to={formURL(f)}>
              {f.can_submit
                ? f.response
                  ? "Edit response"
                  : "Complete form"
                : "View form"}
              <ArrowRight size={16} />
            </Link>
          </Panel>
        ))}
      </div>
    </section>
  );
}

function ResponseEditor({
  form,
  onSaved,
}: {
  form: EventForm;
  onSaved: () => void;
}) {
  const [snapshot, setSnapshot] = useState(form);
  const [answers, setAnswers] = useState<FormAnswersValue>(
    form.response?.answers || {},
  );
  const action = useAction();
  const changed =
    snapshot.revision !== form.revision ||
    snapshot.response?.revision !== form.response?.revision;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void action
          .mutateAsync({
            url: formAPI(form) + "/response",
            method: "PUT",
            body: {
              form_revision: snapshot.revision,
              expected_revision: snapshot.response?.revision ?? null,
              answers: cleanAnswers(snapshot.questions, answers),
            },
          })
          .then(onSaved)
          .catch(() => {});
      }}
    >
      <FormQuestions
        questions={snapshot.questions}
        answers={answers}
        onChange={setAnswers}
      />
      <Message error={action.error} />
      {changed && (
        <Message>
          This form or your saved response changed while you were answering.
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setAnswers(
                snapshot.response?.revision !== form.response?.revision
                  ? form.response?.answers || {}
                  : compatibleAnswers(
                      snapshot.questions,
                      form.questions,
                      answers,
                    ),
              );
              setSnapshot(form);
              action.reset();
            }}
          >
            Review latest version
          </Button>
        </Message>
      )}
      <div className="form-actions">
        <Button disabled={action.isPending || changed}>
          {action.isPending
            ? "Saving…"
            : form.response
              ? "Save changes"
              : "Submit response"}
        </Button>
      </div>
    </form>
  );
}

export function EventFormPage() {
  const { id, number, slug } = useParams();
  const query = useAPI("EventFormView", `/api/events/${id}/forms/${number}`, {
    poll: true,
  });
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  if (query.isPending)
    return (
      <div className="page narrow">
        <Loading />
      </div>
    );
  if (query.error)
    return (
      <div className="page narrow">
        <Failure error={query.error} retry={query.refetch} />
        <Link className="text-link" to={`/events/${slug}/${id}`}>
          Back to event
        </Link>
      </div>
    );
  const form = query.data;
  if (slug !== form.event_slug) return <Navigate replace to={formURL(form)} />;
  return (
    <div className="page event-form-page">
      <Link
        className="text-link"
        to={`/events/${form.event_slug}/${form.event_id}`}
      >
        <ArrowLeft size={16} />
        {form.event_name}
      </Link>
      <Panel className="section">
        <div className="actions">
          <Pill tone={form.required ? "yellow" : "green"}>
            {form.required ? "Required" : "Optional"}
          </Pill>
          <span className="muted">{phaseLabels[form.phase]}</span>
        </div>
        <h1>{form.title}</h1>
        {form.instructions && (
          <p className="preserve-lines">{form.instructions}</p>
        )}
        <p className="form-deadline">
          {form.phase === "scheduled"
            ? `Opens ${formTime(form.opens_at)}`
            : `Due ${formTime(form.closes_at)}`}
        </p>
        {saved && (
          <Message>
            <Check size={18} aria-hidden="true" />
            Your response is saved.
          </Message>
        )}
        {form.phase === "late" && !form.response && (
          <Message>
            The deadline has passed. You can still submit a late response.
          </Message>
        )}
        {form.response && !editing ? (
          <>
            <div className="section">
              <Pill>{responseLabels[form.status!]}</Pill>
              <p className="muted">
                Submitted {formTime(form.response.submitted_at)}
              </p>
            </div>
            <FormAnswers
              questions={form.response.questions}
              answers={form.response.answers}
            />
            {form.can_submit && (
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing(true);
                  setSaved(false);
                }}
              >
                Edit response
              </Button>
            )}
          </>
        ) : form.can_submit ? (
          <ResponseEditor
            key={form.id}
            form={form}
            onSaved={() => {
              setEditing(false);
              setSaved(true);
            }}
          />
        ) : (
          <>
            <Message>
              {form.phase === "scheduled"
                ? "Come back when this form opens to send your response."
                : form.status === "not_required"
                  ? "You signed up after this form closed, so a response is not required."
                  : form.phase === "archived"
                    ? "This form has been archived."
                    : "This form is closed. Contact an officer if you need help."}
            </Message>
            <FormQuestions
              questions={form.questions}
              disabled
              answers={{}}
              onChange={() => {}}
            />
          </>
        )}
      </Panel>
    </div>
  );
}
