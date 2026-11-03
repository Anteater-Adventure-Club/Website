import { useEffect, useRef, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { useAPI, useAction, type Schema } from "../lib/api";
import { QuestionEditor } from "./form-questions";
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

type Template = Schema<"FormTemplateView">;
type Question = Schema<"Question">;
const kindLabels: Record<string, string> = {
  regular: "Regular events",
  retreat: "Retreats",
  meeting: "Meetings",
  picnic: "Picnics",
};

export function FormTemplatePicker({
  kind,
  questions,
  onSelect,
  eventKind,
  autoDefault = false,
  dirty = false,
}: {
  kind: "signup" | "followup";
  questions: Question[];
  onSelect: (template: Template | null, automatic?: boolean) => void;
  eventKind?: string;
  autoDefault?: boolean;
  dirty?: boolean;
}) {
  const query = useAPI("Items_FormTemplateView_", "/api/admin/form-templates");
  const [replace, setReplace] = useState<Template | null>(null);
  const appliedKind = useRef<string | null>(null);
  useEffect(() => {
    if (
      !autoDefault ||
      dirty ||
      !eventKind ||
      !query.data ||
      appliedKind.current === eventKind
    )
      return;
    appliedKind.current = eventKind;
    onSelect(
      query.data.items.find(
        (t) =>
          !t.archived &&
          t.kind === "signup" &&
          t.default_event_kinds.includes(eventKind),
      ) || null,
      true,
    );
  }, [autoDefault, dirty, eventKind, query.data, onSelect]);
  const templates =
    query.data?.items.filter((t) => !t.archived && t.kind === kind) || [];
  if (query.error) return <Failure error={query.error} retry={query.refetch} />;
  if (!templates.length) return null;
  return (
    <>
      <Field
        label="Use a template"
        hint="Copies the questions into this event. Later template edits won’t change them."
      >
        <select
          aria-label="Use a template"
          value=""
          onChange={(e) => {
            const selected = templates.find((t) => t.key === e.target.value);
            if (!selected) return;
            if (questions.length) setReplace(selected);
            else onSelect(selected);
          }}
        >
          <option value="">Choose a template…</option>
          {templates.map((t) => (
            <option value={t.key} key={t.key}>
              {t.title}
            </option>
          ))}
        </select>
      </Field>
      {replace && (
        <Dialog
          title="Replace these questions?"
          onClose={() => setReplace(null)}
        >
          <p>
            Use “{replace.title}” in place of the current questions. Your other
            event settings stay as they are.
          </p>
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setReplace(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onSelect(replace);
                setReplace(null);
              }}
            >
              Use template
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}

function TemplateEditor({
  initial,
  onClose,
}: {
  initial?: Template;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initial?.title || "");
  const [kind, setKind] = useState<"signup" | "followup">(
    initial?.kind || "followup",
  );
  const [instructions, setInstructions] = useState(initial?.instructions || "");
  const [questions, setQuestions] = useState<Question[]>(
    initial?.questions || [],
  );
  const [required, setRequired] = useState(initial?.required || false);
  const [late, setLate] = useState(initial?.allow_late || false);
  const [archived, setArchived] = useState(initial?.archived || false);
  const [defaults, setDefaults] = useState(initial?.default_event_kinds || []);
  const action = useAction();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void action
          .mutateAsync({
            url:
              "/api/admin/form-templates" + (initial ? `/${initial.key}` : ""),
            method: initial ? "PUT" : "POST",
            body: {
              expected_revision: initial?.revision,
              title,
              kind,
              instructions,
              questions,
              required,
              allow_late: late,
              archived,
              default_event_kinds:
                !archived && kind === "signup" ? defaults : [],
            },
          })
          .then(onClose)
          .catch(() => {});
      }}
    >
      <Field
        label="Template name"
        required
        maxLength={150}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Field label="Template purpose">
        <select
          aria-label="Template purpose"
          disabled={!!initial}
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
        >
          <option value="followup">Event follow-up</option>
          <option value="signup">Signup questions</option>
        </select>
      </Field>
      {kind === "followup" ? (
        <>
          <Field label="Instructions">
            <textarea
              aria-label="Instructions"
              maxLength={5000}
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </Field>
          <label className="check-field">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
            />
            Required by default
          </label>
          <Field label="Allow Late Submissions?">
            <select
              aria-label="Allow Late Submissions?"
              value={late ? "yes" : "no"}
              onChange={(e) => setLate(e.target.value === "yes")}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </Field>
        </>
      ) : (
        <fieldset className="template-defaults">
          <legend>Default signup questions for</legend>
          <p className="muted">
            Used for new events of these types. Selecting a type replaces its
            previous default.
          </p>
          {Object.entries(kindLabels).map(([value, label]) => (
            <label className="check-field" key={value}>
              <input
                type="checkbox"
                checked={defaults.includes(value)}
                onChange={(e) =>
                  setDefaults(
                    e.target.checked
                      ? [...defaults, value]
                      : defaults.filter((v) => v !== value),
                  )
                }
              />
              {label}
            </label>
          ))}
        </fieldset>
      )}
      <QuestionEditor questions={questions} onChange={setQuestions} />
      {initial && (
        <label className="check-field">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          Archive this template
        </label>
      )}
      <Message error={action.error} />
      <div className="sticky-actions form-actions">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={action.isPending || !questions.length}>
          Save template
        </Button>
      </div>
    </form>
  );
}

export function FormTemplateManager() {
  const query = useAPI("Items_FormTemplateView_", "/api/admin/form-templates");
  const [editing, setEditing] = useState<Template | "new" | null>(null);
  const [archived, setArchived] = useState(false);
  return (
    <>
      <div className="toolbar">
        <div>
          <h2>Reusable templates</h2>
          <p className="muted">A starting point for your next adventure.</p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus size={18} />
          New template
        </Button>
      </div>
      <label className="check-field">
        <input
          type="checkbox"
          checked={archived}
          onChange={(e) => setArchived(e.target.checked)}
        />
        Show archived templates
      </label>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <Failure error={query.error} retry={query.refetch} />
      ) : (
        <div className="stack section">
          {!query.data.items.filter((t) => archived || !t.archived).length && (
            <Empty title="Your next form starts here">
              Create signup questions or a follow-up template to reuse across
              events.
            </Empty>
          )}
          {query.data.items
            .filter((t) => archived || !t.archived)
            .map((t) => (
              <Panel className="record-card" key={t.key}>
                <div>
                  <Pill>
                    {t.archived
                      ? "Archived"
                      : t.kind === "signup"
                        ? "Signup questions"
                        : "Event follow-up"}
                  </Pill>
                  <h3>{t.title}</h3>
                  <p>
                    {t.questions.length} questions
                    {t.default_event_kinds.length
                      ? ` · Default for ${t.default_event_kinds.map((k) => kindLabels[k].toLowerCase()).join(", ")}`
                      : ""}
                  </p>
                </div>
                <Button variant="secondary" onClick={() => setEditing(t)}>
                  <Pencil size={16} />
                  Edit template
                </Button>
              </Panel>
            ))}
        </div>
      )}
      {editing && (
        <Dialog
          title={editing === "new" ? "New template" : "Edit template"}
          wide
          onClose={() => setEditing(null)}
        >
          <TemplateEditor
            initial={editing === "new" ? undefined : editing}
            onClose={() => setEditing(null)}
          />
        </Dialog>
      )}
    </>
  );
}
