// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import {
  cleanAnswers,
  compatibleAnswers,
  FormQuestions,
  QuestionEditor,
  visibleQuestions,
  wordCount,
} from "./form-questions";
import type { FormAnswersValue, FormQuestion } from "./form-questions";

afterEach(cleanup);
const questions: FormQuestion[] = [
  {
    id: "student",
    label: "College student?",
    kind: "yes-no",
    required: true,
    options: [],
  },
  {
    id: "email",
    label: "College email",
    kind: "email",
    required: true,
    options: [],
    show_when: { question_id: "student", equals: "yes" },
  },
  {
    id: "about",
    label: "About you",
    kind: "long",
    required: true,
    options: [],
    max_words: 250,
  },
];

function Editor({
  initial = questions,
  frozenIds = new Set<string>(),
}: {
  initial?: FormQuestion[];
  frozenIds?: Set<string>;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <QuestionEditor
        questions={value}
        onChange={setValue}
        frozenIds={frozenIds}
      />
      <output>{JSON.stringify(value)}</output>
    </>
  );
}

it("keeps a conditional parent’s type locked until every dependent condition is removed", () => {
  render(
    <Editor
      initial={[
        ...questions,
        {
          id: "school",
          label: "School",
          kind: "text",
          required: true,
          options: [],
          show_when: { question_id: "student", equals: "yes" },
        },
      ]}
    />,
  );
  const parentType = screen.getAllByLabelText(
    "Answer type",
  )[0] as HTMLSelectElement;
  expect(parentType.disabled).toBe(true);
  expect(
    screen.getByText(/before changing its answer type or removing it/),
  ).toBeTruthy();
  const conditions = screen.getAllByLabelText("Show this question");
  fireEvent.change(conditions[0], { target: { value: "" } });
  expect(parentType.disabled).toBe(true);
  fireEvent.change(conditions[2], { target: { value: "" } });
  expect(parentType.disabled).toBe(false);
  fireEvent.change(parentType, { target: { value: "text" } });
  const saved = JSON.parse(screen.getByRole("status").textContent!);
  expect(saved[0].kind).toBe("text");
  expect(saved.every((q: FormQuestion) => !q.show_when)).toBe(true);
  expect(
    screen.queryByText(/before changing its answer type or removing it/),
  ).toBeNull();
});

it("preserves frozen question types after their dependent conditions are removed", () => {
  render(<Editor frozenIds={new Set(["student"])} />);
  fireEvent.change(screen.getAllByLabelText("Show this question")[0], {
    target: { value: "" },
  });
  expect(
    (screen.getAllByLabelText("Answer type")[0] as HTMLSelectElement).disabled,
  ).toBe(true);
  expect(
    (screen.getAllByLabelText("Answer type")[1] as HTMLSelectElement).disabled,
  ).toBe(false);
});

function Form() {
  const [answers, setAnswers] = useState<FormAnswersValue>({});
  return (
    <form>
      <FormQuestions
        questions={questions}
        answers={answers}
        onChange={setAnswers}
      />
      <output>{JSON.stringify(answers)}</output>
    </form>
  );
}

it("reveals student details and removes hidden answers when the selection changes", () => {
  render(<Form />);
  expect(screen.queryByLabelText("College email")).toBeNull();
  fireEvent.change(screen.getByLabelText("College student?"), {
    target: { value: "yes" },
  });
  fireEvent.change(screen.getByLabelText("College email"), {
    target: { value: "student@school.edu" },
  });
  expect(
    (screen.getByLabelText("College email") as HTMLInputElement).required,
  ).toBe(true);
  fireEvent.change(screen.getByLabelText("College student?"), {
    target: { value: "no" },
  });
  expect(screen.queryByLabelText("College email")).toBeNull();
  expect(screen.getByRole("status").textContent).not.toContain("school.edu");
});

it("enforces the word boundary and clears validity after correcting an answer", () => {
  render(<Form />);
  const about = screen.getByLabelText("About you") as HTMLTextAreaElement;
  fireEvent.change(about, { target: { value: "word ".repeat(251) } });
  expect(about.validity.customError).toBe(true);
  expect(screen.getByText(/251 \/ 250 words/)).toBeTruthy();
  fireEvent.change(about, {
    target: { value: "longadventureword\n\t".repeat(250) },
  });
  expect(about.checkValidity()).toBe(true);
  expect(wordCount("  one\n two\tthree  ")).toBe(3);
  expect(wordCount(" \t\n ")).toBe(0);
});

it("preserves compatible answers when the questionnaire revision changes", () => {
  const answers = {
    student: "yes",
    email: "person@school.edu",
    about: "I like hiking",
    unknown: "ignore",
  };
  const updated = [
    ...questions,
    {
      id: "new",
      label: "New question",
      kind: "text",
      required: true,
      options: [],
    } as FormQuestion,
  ];
  expect(compatibleAnswers(questions, updated, answers)).toEqual({
    student: "yes",
    email: "person@school.edu",
    about: "I like hiking",
  });
  expect(cleanAnswers(questions, { ...answers, student: "no" })).toEqual({
    student: "no",
    about: "I like hiking",
  });
  expect(visibleQuestions(questions, {}).map((q) => q.id)).toEqual([
    "student",
    "about",
  ]);
});
