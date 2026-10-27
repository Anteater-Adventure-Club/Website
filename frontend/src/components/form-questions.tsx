import { useId } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { Schema } from "../lib/api";
import { Button, Field, Panel } from "./ui";
import { MultipleSelectQuestion } from "./multiple-select-question";

export type FormQuestion = Schema<"Question">;
export type FormAnswersValue = Record<string, string | string[]>;
export const wordCount = (value: string) =>
  value.trim() ? value.trim().split(/\s+/u).length : 0;

export function visibleQuestions(
  questions: FormQuestion[],
  answers: FormAnswersValue,
) {
  const visible = new Set<string>();
  return questions.filter((q) => {
    const condition = q.show_when;
    if (
      condition &&
      (!visible.has(condition.question_id) ||
        answers[condition.question_id] !== condition.equals)
    )
      return false;
    visible.add(q.id);
    return true;
  });
}

export function cleanAnswers(
  questions: FormQuestion[],
  answers: FormAnswersValue,
): FormAnswersValue {
  const ids = new Set(visibleQuestions(questions, answers).map((q) => q.id));
  return Object.fromEntries(
    Object.entries(answers).filter(([id]) => ids.has(id)),
  );
}

export function compatibleAnswers(
  previous: FormQuestion[],
  next: FormQuestion[],
  answers: FormAnswersValue,
) {
  return cleanAnswers(
    next,
    Object.fromEntries(
      next
        .filter((q) => {
          const old = previous.find((p) => p.id === q.id);
          return (
            old?.kind === q.kind &&
            JSON.stringify(old.options) === JSON.stringify(q.options)
          );
        })
        .filter((q) => q.id in answers)
        .map((q) => [q.id, answers[q.id]]),
    ),
  );
}

function AnswerField({
  question: q,
  value,
  onChange,
  disabled,
}: {
  question: FormQuestion;
  value?: string | string[];
  onChange: (value: string | string[]) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const text = typeof value === "string" ? value : "";
  const words = wordCount(text);
  const error =
    q.max_words && words > q.max_words
      ? `Use no more than ${q.max_words} words.`
      : "";
  if (q.kind === "multiple-select")
    return (
      <MultipleSelectQuestion
        question={q}
        value={value}
        onChange={onChange}
        onBlur={() => {}}
        name={id}
        inputRef={() => {}}
      />
    );
  const props = {
    id,
    value: text,
    required: q.required,
    disabled,
    "aria-describedby": `${id}-hint`,
    "aria-invalid": !!error,
    onChange: (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => onChange(event.target.value),
  };
  return (
    <div className="field form-question">
      <label htmlFor={id}>
        {q.label}
        {!q.required && <small>Optional</small>}
      </label>
      {q.kind === "choice" || q.kind === "yes-no" ? (
        <select {...props}>
          <option value="">Choose an answer</option>
          {(q.kind === "yes-no" ? ["yes", "no"] : q.options || []).map(
            (option) => (
              <option key={option} value={option}>
                {q.kind === "yes-no"
                  ? option === "yes"
                    ? "Yes"
                    : "No"
                  : option}
              </option>
            ),
          )}
        </select>
      ) : q.kind === "long" ? (
        <textarea
          {...props}
          rows={5}
          maxLength={q.max_words ? 20000 : 2000}
          ref={(el) => {
            el?.setCustomValidity(error);
          }}
        />
      ) : (
        <input
          {...props}
          type={q.kind === "email" ? "email" : "text"}
          maxLength={q.kind === "email" ? 254 : q.max_words ? 20000 : 2000}
          ref={(el) => {
            el?.setCustomValidity(error);
          }}
        />
      )}
      <small id={`${id}-hint`} className={error ? "form-field-error" : "muted"}>
        {q.max_words
          ? `${words} / ${q.max_words} words${error ? ` · ${error}` : ""}`
          : q.required
            ? "Required"
            : ""}
      </small>
    </div>
  );
}

export function FormQuestions({
  questions,
  answers = {},
  onChange,
  filter,
  disabled,
}: {
  questions: FormQuestion[];
  answers?: FormAnswersValue;
  onChange: (answers: FormAnswersValue) => void;
  filter?: "required" | "optional";
  disabled?: boolean;
}) {
  return (
    <>
      {visibleQuestions(questions, answers)
        .filter(
          (q) => !filter || (filter === "required" ? q.required : !q.required),
        )
        .map((q) => (
          <AnswerField
            key={q.id}
            question={q}
            value={answers[q.id]}
            disabled={disabled}
            onChange={(value) =>
              onChange(cleanAnswers(questions, { ...answers, [q.id]: value }))
            }
          />
        ))}
    </>
  );
}

export function FormAnswers({
  questions,
  answers,
}: {
  questions: FormQuestion[];
  answers: FormAnswersValue;
}) {
  return (
    <dl className="application-answers">
      {visibleQuestions(questions, answers).map((q) => {
        const answer = answers[q.id];
        const value = Array.isArray(answer)
          ? answer.join(", ")
          : q.kind === "yes-no" && answer
            ? answer === "yes"
              ? "Yes"
              : "No"
            : answer;
        return (
          <div key={q.id}>
            <dt>{q.label}</dt>
            <dd className="preserve-lines">{value || "Not provided"}</dd>
          </div>
        );
      })}
    </dl>
  );
}

export function QuestionEditor({
  questions,
  onChange,
  frozenIds = new Set(),
  optionalOnly = false,
}: {
  questions: FormQuestion[];
  onChange: (questions: FormQuestion[]) => void;
  frozenIds?: Set<string>;
  optionalOnly?: boolean;
}) {
  function change(id: string, patch: Partial<FormQuestion>) {
    onChange(questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }
  function moved(index: number, direction: number) {
    const next = [...questions];
    [next[index], next[index + direction]] = [
      next[index + direction],
      next[index],
    ];
    return next;
  }
  function canMove(index: number, direction: number) {
    if (
      index + direction < 0 ||
      index + direction >= questions.length ||
      frozenIds.has(questions[index].id) ||
      frozenIds.has(questions[index + direction].id)
    )
      return false;
    return moved(index, direction).every(
      (q, i, all) =>
        !q.show_when ||
        all.slice(0, i).some((p) => p.id === q.show_when?.question_id),
    );
  }
  return (
    <div className="stack question-list">
      {questions.map((q, index) => {
        const frozen = frozenIds.has(q.id);
        const hasDependents = questions.some(
          (p) => p.show_when?.question_id === q.id,
        );
        const parents = questions
          .slice(0, index)
          .filter((p) => p.kind === "yes-no" || p.kind === "choice");
        const parent = parents.find((p) => p.id === q.show_when?.question_id);
        return (
          <Panel className="question-editor" key={q.id}>
            <div className="section-heading">
              <strong>Question {index + 1}</strong>
              <div className="actions">
                <Button
                  type="button"
                  variant="quiet"
                  aria-label={`Move question ${index + 1} up`}
                  disabled={!canMove(index, -1)}
                  onClick={() => onChange(moved(index, -1))}
                >
                  <ArrowUp size={16} />
                </Button>
                <Button
                  type="button"
                  variant="quiet"
                  aria-label={`Move question ${index + 1} down`}
                  disabled={!canMove(index, 1)}
                  onClick={() => onChange(moved(index, 1))}
                >
                  <ArrowDown size={16} />
                </Button>
              </div>
            </div>
            <Field
              label="Question"
              value={q.label}
              maxLength={200}
              required
              disabled={frozen}
              onChange={(e) => change(q.id, { label: e.target.value })}
            />
            <label className="field">
              Answer type
              <select
                value={q.kind || "text"}
                disabled={frozen || hasDependents}
                onChange={(e) =>
                  change(q.id, {
                    kind: e.target.value as FormQuestion["kind"],
                    max_words: null,
                    options: ["choice", "multiple-select"].includes(
                      e.target.value,
                    )
                      ? q.options?.length
                        ? q.options
                        : ["Option 1", "Option 2"]
                      : [],
                  })
                }
              >
                <option value="text">Short text</option>
                <option value="long">Long text</option>
                <option value="email">Email</option>
                <option value="choice">Multiple choice</option>
                <option value="multiple-select">Multiple select</option>
                <option value="yes-no">Yes / No</option>
              </select>
            </label>
            {(q.kind === "choice" || q.kind === "multiple-select") && (
              <label className="field">
                Choices · one per line
                <textarea
                  disabled={frozen}
                  value={q.options?.join("\n") || ""}
                  onChange={(e) =>
                    change(q.id, { options: e.target.value.split("\n") })
                  }
                />
              </label>
            )}
            {(q.kind === "text" || q.kind === "long") && (
              <Field
                label="Maximum words"
                type="number"
                min={1}
                max={2000}
                disabled={frozen}
                value={q.max_words ?? ""}
                hint="Leave empty for the standard text limit."
                onChange={(e) =>
                  change(q.id, {
                    max_words: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            )}
            {parents.length > 0 && (
              <div className="form-grid">
                <label className="field">
                  Show this question
                  <select
                    disabled={frozen}
                    value={q.show_when?.question_id || ""}
                    onChange={(e) => {
                      const selected = parents.find(
                        (p) => p.id === e.target.value,
                      );
                      change(q.id, {
                        show_when: selected
                          ? {
                              question_id: selected.id,
                              equals:
                                selected.kind === "yes-no"
                                  ? "yes"
                                  : selected.options![0],
                            }
                          : null,
                      });
                    }}
                  >
                    <option value="">Always</option>
                    {parents.map((p) => (
                      <option key={p.id} value={p.id}>
                        When: {p.label || "Untitled question"}
                      </option>
                    ))}
                  </select>
                </label>
                {parent && (
                  <label className="field">
                    Answer is
                    <select
                      disabled={frozen}
                      value={q.show_when!.equals}
                      onChange={(e) =>
                        change(q.id, {
                          show_when: {
                            question_id: parent.id,
                            equals: e.target.value,
                          },
                        })
                      }
                    >
                      {(parent.kind === "yes-no"
                        ? ["yes", "no"]
                        : parent.options || []
                      ).map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            )}
            <div className="toolbar">
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={q.required || false}
                  disabled={frozen || optionalOnly}
                  onChange={(e) => change(q.id, { required: e.target.checked })}
                />
                Required
              </label>
              <Button
                type="button"
                variant="quiet"
                aria-label={`Remove question ${q.label}`}
                disabled={frozen || hasDependents}
                onClick={() => onChange(questions.filter((p) => p.id !== q.id))}
              >
                <Trash2 size={16} />
                Remove
              </Button>
            </div>
            {hasDependents && (
              <small className="muted">
                Other questions depend on this one. Remove their conditions
                before changing its answer type or removing it.
              </small>
            )}
          </Panel>
        );
      })}
      <Button
        type="button"
        variant="secondary"
        disabled={questions.length >= 20}
        onClick={() =>
          onChange([
            ...questions,
            {
              id: crypto.randomUUID(),
              label: "",
              kind: "text",
              required: false,
              options: [],
              max_words: null,
              show_when: null,
            },
          ])
        }
      >
        <Plus size={16} />
        Add Question
      </Button>
    </div>
  );
}
