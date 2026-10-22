// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Controller, useForm } from "react-hook-form";
import type { Schema } from "../lib/api";
import { MultipleSelectQuestion } from "./multiple-select-question";

afterEach(cleanup);

function Signup({
  initial = [],
  required = false,
  onSubmit,
}: {
  initial?: string[];
  required?: boolean;
  onSubmit: (value: Schema<"SignupWrite">) => void;
}) {
  const form = useForm<Schema<"SignupWrite">>({
    defaultValues: { role: "own", answers: { activities: initial } },
  });
  return (
    <form aria-label="Signup" onSubmit={form.handleSubmit(onSubmit)}>
      <Controller
        control={form.control}
        name="answers.activities"
        defaultValue={[]}
        render={({ field: { ref, ...field } }) => (
          <MultipleSelectQuestion
            question={{
              id: "activities",
              label: "Which activities?",
              kind: "multiple-select",
              required,
              options: ["Hiking", "Swimming", "Picnic, games"],
            }}
            inputRef={ref}
            {...field}
          />
        )}
      />
      <button type="submit">Save</button>
    </form>
  );
}

it("saves multiple choices as an array and restores them for editing", async () => {
  const onSubmit = vi.fn();
  const view = render(<Signup onSubmit={onSubmit} />);
  fireEvent.click(screen.getByRole("checkbox", { name: "Picnic, games" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Hiking" }));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  const saved = onSubmit.mock.calls[0][0].answers.activities;
  expect(saved).toEqual(["Hiking", "Picnic, games"]);
  view.unmount();
  render(<Signup initial={saved} onSubmit={onSubmit} />);
  expect(
    (screen.getByRole("checkbox", { name: "Hiking" }) as HTMLInputElement)
      .checked,
  ).toBe(true);
  expect(
    (
      screen.getByRole("checkbox", {
        name: "Picnic, games",
      }) as HTMLInputElement
    ).checked,
  ).toBe(true);
  expect(
    (screen.getByRole("checkbox", { name: "Swimming" }) as HTMLInputElement)
      .checked,
  ).toBe(false);
  fireEvent.click(screen.getByRole("checkbox", { name: "Hiking" }));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
  expect(onSubmit.mock.calls[1][0].answers.activities).toEqual([
    "Picnic, games",
  ]);
});

it("requires any one choice and becomes invalid again when all are cleared", () => {
  render(<Signup required onSubmit={vi.fn()} />);
  const form = screen.getByRole("form", { name: "Signup" }) as HTMLFormElement;
  expect(screen.getByRole("group", { name: "Which activities?" })).toBeTruthy();
  expect(form.checkValidity()).toBe(false);
  fireEvent.click(screen.getByRole("checkbox", { name: "Swimming" }));
  expect(form.checkValidity()).toBe(true);
  fireEvent.click(screen.getByRole("checkbox", { name: "Swimming" }));
  expect(form.checkValidity()).toBe(false);
});

it("saves an empty array when an optional answer is cleared", async () => {
  const onSubmit = vi.fn();
  render(<Signup initial={["Swimming"]} onSubmit={onSubmit} />);
  fireEvent.click(screen.getByRole("checkbox", { name: "Swimming" }));
  expect(
    (
      screen.getByRole("form", { name: "Signup" }) as HTMLFormElement
    ).checkValidity(),
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  expect(onSubmit.mock.calls[0][0].answers.activities).toEqual([]);
});
