import { useId } from "react";
import type { Ref } from "react";
import type { Schema } from "../lib/api";

export function MultipleSelectQuestion({
  question,
  value,
  onChange,
  onBlur,
  name,
  inputRef,
}: {
  question: Schema<"Question">;
  value: string | string[] | undefined;
  onChange: (value: string[]) => void;
  onBlur: () => void;
  name: string;
  inputRef: Ref<HTMLInputElement>;
}) {
  const hintId = useId();
  const selected = Array.isArray(value) ? value : [];
  return (
    <fieldset className="field" aria-describedby={hintId}>
      <legend>{question.label}</legend>
      <small id={hintId}>
        {question.required ? "Select at least one." : "Optional."} Select all
        that apply.
      </small>
      {(question.options || []).map((option, index) => (
        <label className="check-field" key={option}>
          <input
            type="checkbox"
            name={name}
            value={option}
            checked={selected.includes(option)}
            required={question.required && selected.length === 0 && index === 0}
            ref={index === 0 ? inputRef : undefined}
            onBlur={onBlur}
            onChange={(event) =>
              onChange(
                (question.options || []).filter((choice) =>
                  choice === option
                    ? event.target.checked
                    : selected.includes(choice),
                ),
              )
            }
          />
          {option}
        </label>
      ))}
    </fieldset>
  );
}
