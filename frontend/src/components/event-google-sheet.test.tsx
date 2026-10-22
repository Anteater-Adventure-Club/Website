// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Schema } from "../lib/api";
import { SheetColumns } from "./event-google-sheet";

afterEach(cleanup);

const catalog = [
  { key: "name", header: "Name" },
  { key: "email", header: "Email" },
  { key: "status", header: "Signup status" },
  { key: "question:activities", header: "Activities" },
];
const initial: Schema<"EventSheetView"> = {
  configured: false,
  enabled: false,
  revision: null,
  columns: catalog,
  catalog,
  spreadsheet_url: null,
  status: "not_configured",
  last_synced_at: null,
  pending_since: null,
  error: "",
  sharing_pending: false,
  sharing_error: "",
  preview: [["Alex", "alex@example.com", "Cancelled", "Hiking\nPicnic, games"]],
};

it("selects, renames, and reorders columns while keeping preview values aligned", () => {
  const save = vi.fn();
  render(
    <SheetColumns
      initial={initial}
      onSave={save}
      busy={false}
      disabled={false}
    />,
  );
  fireEvent.click(screen.getByRole("checkbox", { name: "Email" }));
  fireEvent.change(screen.getByLabelText("Heading for Activities"), {
    target: { value: "Plans" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Move Activities up" }));
  const preview = screen.getByRole("region", { name: "Spreadsheet preview" });
  expect(
    within(preview)
      .getAllByRole("columnheader")
      .map((el) => el.textContent),
  ).toEqual(["Name", "Plans", "Signup status"]);
  expect(
    within(preview)
      .getAllByRole("cell")
      .map((el) => el.textContent),
  ).toEqual(["Alex", "Hiking\nPicnic, games", "Cancelled"]);
  fireEvent.click(screen.getByRole("button", { name: "Create spreadsheet" }));
  expect(save).toHaveBeenCalledWith([
    catalog[0],
    { key: "question:activities", header: "Plans" },
    catalog[2],
  ]);
  expect(
    (
      screen.getByRole("checkbox", {
        name: "Signup status (required)",
      }) as HTMLInputElement
    ).disabled,
  ).toBe(true);
});

it("adds a previously unselected column and previews it from the full catalog", () => {
  render(
    <SheetColumns
      initial={{ ...initial, configured: true, columns: [catalog[2]] }}
      onSave={vi.fn()}
      busy={false}
      disabled={false}
    />,
  );
  fireEvent.click(screen.getByRole("checkbox", { name: "Activities" }));
  expect(
    screen.getByRole("cell", { name: /Hiking\s+Picnic, games/ }),
  ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Save column settings" }),
  ).toBeTruthy();
});

it("prevents configuration while the club account is disconnected", () => {
  render(
    <SheetColumns initial={initial} onSave={vi.fn()} busy={false} disabled />,
  );
  expect(
    (
      screen.getByRole("group", {
        name: "Choose columns",
      }) as HTMLFieldSetElement
    ).disabled,
  ).toBe(true);
  expect(
    (
      screen.getByRole("button", {
        name: "Create spreadsheet",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});
