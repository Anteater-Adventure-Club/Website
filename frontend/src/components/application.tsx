import { approvalLabel } from "../lib/approval";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, Navigate } from "react-router";
import { Clock, ClipboardList } from "lucide-react";
import { dateLabel, useAction, useAPI } from "../lib/api";
import type { Person, Schema } from "../lib/api";
import { useIdentity } from "../lib/context";
import { Button, Dialog, Failure, Loading, Message, Panel, Pill } from "./ui";
import {
  compatibleAnswers,
  FormAnswers,
  FormQuestions,
  QuestionEditor,
} from "./form-questions";
import type { FormAnswersValue } from "./form-questions";

function ApplicantForm({
  application,
}: {
  application: Schema<"ApplicationView">;
}) {
  const [answers, setAnswers] = useState<FormAnswersValue>({});
  const previous = useRef(application);
  const action = useAction();
  useEffect(() => {
    if (previous.current.form_revision !== application.form_revision) {
      const oldQuestions = previous.current.questions || [];
      setAnswers((old) =>
        compatibleAnswers(oldQuestions, application.questions || [], old),
      );
      previous.current = application;
    }
  }, [application]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void action
          .mutateAsync({
            url: "/api/me/application",
            body: { form_revision: application.form_revision, answers },
          })
          .catch(() => {});
      }}
    >
      <FormQuestions
        questions={application.questions || []}
        answers={answers}
        onChange={setAnswers}
      />
      <Message error={action.error} />
      <div className="application-submit">
        <p className="muted">
          Please check your answers before submitting. You won’t be able to edit
          them afterward.
        </p>
        <Button disabled={action.isPending}>
          {action.isPending ? "Submitting…" : "Submit application"}
        </Button>
      </div>
    </form>
  );
}

export function ApplicationPage() {
  const { session } = useIdentity();
  const cache = useQueryClient();
  const query = useAPI("ApplicationView", "/api/me/application", {
    poll: (data) => data?.status === "pending",
  });
  useEffect(() => {
    if (query.data && session?.member?.approval_status !== query.data.status) {
      void cache.invalidateQueries({ queryKey: ["SessionView"] });
    }
  }, [cache, query.data?.status, session?.member?.approval_status]);
  if (session?.member?.approval_status === "approved")
    return <Navigate replace to="/my-aac" />;
  if (query.isPending)
    return (
      <div className="page">
        <Loading />
      </div>
    );
  if (query.error)
    return (
      <div className="page">
        <Failure error={query.error} retry={query.refetch} />
      </div>
    );
  const application = query.data;
  // Refresh the session before redirecting so the member guard grants access.
  if (application.status === "approved")
    return (
      <div className="page">
        <Loading />
      </div>
    );
  const title = {
    required: "Your next adventure starts here",
    pending: "Thanks for introducing yourself!",
    denied: "Your application was not approved",
  }[application.status];
  return (
    <div className="page application-page">
      <div className="application-heading">
        <span className="application-icon" aria-hidden="true">
          {application.status === "pending" ? (
            <Clock size={28} />
          ) : (
            <ClipboardList size={28} />
          )}
        </span>
        <p className="eyebrow">Adventure Club · New member application</p>
        <h1>{title}</h1>
        <p>
          {application.status === "required"
            ? "No UCI email? Tell us a little about yourself. Our officers review new applications before welcoming members into the club."
            : application.status === "pending"
              ? "Your application is with our officers. Check back here for their decision. You’re welcome to explore our public events while you wait."
              : "This decision is final. Another application cannot be submitted, but you can continue browsing our public pages."}
        </p>
      </div>
      <Panel>
        <div className="section-heading application-identity">
          <div>
            <strong>{session?.member?.name}</strong>
            <small>{session?.member?.email}</small>
          </div>
          <Pill tone={application.status === "denied" ? "orange" : "yellow"}>
            {approvalLabel(application.status)}
          </Pill>
        </div>
        {application.status === "required" ? (
          <ApplicantForm application={application} />
        ) : (
          <>
            {application.status === "denied" && application.message && (
              <div className="notice">
                <strong>Message from the officers</strong>
                <p className="preserve-lines">{application.message}</p>
              </div>
            )}
            {application.submitted_at && (
              <p className="muted">
                Submitted {dateLabel(application.submitted_at)}
                {application.reviewed_at &&
                  ` · Reviewed ${dateLabel(application.reviewed_at)}`}
              </p>
            )}
            <div className="actions">
              <Link className="button secondary" to="/events">
                Browse events
              </Link>
              {application.status === "pending" && (
                <Button
                  variant="quiet"
                  disabled={query.isFetching}
                  onClick={() => void query.refetch()}
                >
                  Refresh status
                </Button>
              )}
            </div>
            {application.submitted_at && (
              <details className="section">
                <summary>Your submitted answers</summary>
                <FormAnswers
                  questions={application.questions || []}
                  answers={application.answers || {}}
                />
              </details>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}

export function ApplicationReview({ person }: { person: Person }) {
  const query = useAPI(
    "ApplicationView",
    `/api/admin/members/${person.id}/application`,
  );
  const action = useAction();
  const [message, setMessage] = useState("");
  const [deny, setDeny] = useState(false);
  if (query.isPending) return <Loading />;
  if (query.error) return <Failure error={query.error} retry={query.refetch} />;
  const application = query.data;
  if (application.status === "approved" && !application.submitted_at)
    return null;
  async function decide(decision: "approved" | "denied") {
    await action
      .mutateAsync({
        url: `/api/admin/members/${person.id}/application/decision`,
        body: decision === "denied" ? { decision, message } : { decision },
      })
      .then(() => setDeny(false))
      .catch(() => {});
  }
  return (
    <section className="application-review section">
      <div className="section-heading">
        <h3>Club application</h3>
        <Pill tone={application.status === "denied" ? "orange" : "yellow"}>
          {approvalLabel(application.status)}
        </Pill>
      </div>
      {application.submitted_at ? (
        <>
          <p className="muted">
            Submitted {dateLabel(application.submitted_at)}
            {application.reviewed_at &&
              ` · Reviewed ${dateLabel(application.reviewed_at)}`}
          </p>
          <FormAnswers
            questions={application.questions || []}
            answers={application.answers || {}}
          />
        </>
      ) : (
        <p>This person has not submitted their application yet.</p>
      )}
      {application.status === "denied" && application.message && (
        <div className="notice">
          <strong>Reason for denial</strong>
          <p className="preserve-lines">{application.message}</p>
        </div>
      )}
      {application.status === "pending" && (
        <>
          <Message error={action.error} />
          <div className="actions">
            <Button
              disabled={action.isPending}
              onClick={() => void decide("approved")}
            >
              Approve application
            </Button>
            <Button
              variant="secondary"
              disabled={action.isPending}
              onClick={() => setDeny(true)}
            >
              Deny application
            </Button>
          </div>
        </>
      )}
      {deny && application.status === "pending" && (
        <Dialog title="Deny this application?" onClose={() => setDeny(false)}>
          <p>
            {person.name} will not be able to join club activities or submit
            another application. This decision is final.
          </p>
          <label className="field">
            Reason for denial <small>Optional · shown to the applicant</small>
            <textarea
              rows={3}
              maxLength={1000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          <Message error={action.error} />
          <div className="actions section">
            <Button
              variant="secondary"
              disabled={action.isPending}
              onClick={() => setDeny(false)}
            >
              Keep reviewing
            </Button>
            <Button
              disabled={action.isPending}
              onClick={() => void decide("denied")}
            >
              Confirm denial
            </Button>
          </div>
        </Dialog>
      )}
    </section>
  );
}

function ApplicationFormEditor({
  initial,
  onClose,
  reload,
}: {
  initial: Schema<"ApplicationFormView">;
  onClose: () => void;
  reload: () => Promise<Schema<"ApplicationFormView">>;
}) {
  const [questions, setQuestions] = useState(initial.questions);
  const [revision, setRevision] = useState(initial.revision);
  const action = useAction();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void action
          .mutateAsync({
            url: "/api/admin/application-form",
            method: "PUT",
            body: { expected_revision: revision, questions },
          })
          .then(onClose)
          .catch(() => {});
      }}
    >
      <p>
        Configure the application for new members without a UCI email. Changes
        apply to new submissions; submitted answers keep their original
        questions.
      </p>
      <QuestionEditor questions={questions} onChange={setQuestions} />
      <Message error={action.error} />
      {action.error?.code === "revision_conflict" && (
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            void reload()
              .then((latest) => {
                setQuestions(latest.questions);
                setRevision(latest.revision);
                action.reset();
              })
              .catch(() => {});
          }}
        >
          Discard edits and load latest questions
        </Button>
      )}
      <div className="sticky-actions">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={action.isPending || !questions.length}>
          Save questions
        </Button>
      </div>
    </form>
  );
}

export function ApplicationSettings() {
  const [open, setOpen] = useState(false);
  const query = useAPI("ApplicationFormView", "/api/admin/application-form", {
    enabled: open,
  });
  return (
    <>
      <Panel className="record-card section">
        <div>
          <h2>External Member Application</h2>
          <p>Choose what to ask new members who don’t have a UCI email.</p>
        </div>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Edit application questions
        </Button>
      </Panel>
      {open && (
        <Dialog
          title="External Member Application"
          wide
          onClose={() => setOpen(false)}
        >
          {query.isPending ? (
            <Loading />
          ) : query.error ? (
            <Failure error={query.error} retry={query.refetch} />
          ) : (
            <ApplicationFormEditor
              initial={query.data}
              onClose={() => setOpen(false)}
              reload={async () => {
                const latest = await query.refetch();
                if (!latest.data || latest.error) throw latest.error;
                return latest.data;
              }}
            />
          )}
        </Dialog>
      )}
    </>
  );
}
