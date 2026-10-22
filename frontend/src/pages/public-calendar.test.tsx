// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Events } from "./public";

vi.mock("../lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/api")>()),
  useAPI: (schema: string) => ({
    data: {
      items:
        schema === "Page_EventPublic_"
          ? [
              {
                id: 1,
                slug: "club-walk",
                name: "Club walk",
                kind: "regular",
                state: "published",
                starts_at: "2026-11-26T17:00:00Z",
                ends_at: "2026-11-26T18:00:00Z",
              },
              {
                id: 2,
                slug: "club-meeting",
                name: "Club meeting",
                kind: "meeting",
                state: "cancelled",
                starts_at: "2026-11-26T18:00:00Z",
                ends_at: "2026-11-26T19:00:00Z",
              },
            ]
          : [],
    },
    isPending: false,
  }),
}));

function CurrentPath() {
  return <div data-testid="current-path">{useLocation().pathname}</div>;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-26T20:00:00Z"));
  render(
    <MemoryRouter initialEntries={["/events"]}>
      <Routes>
        <Route path="/events" element={<Events />} />
        <Route path="/events/:slug/:id" element={<h1>Event page</h1>} />
      </Routes>
      <CurrentPath />
    </MemoryRouter>,
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const day = () =>
  within(screen.getByRole("group", { name: "Event calendar" })).getByRole(
    "button",
    { name: /^November 26,/ },
  );
const categories = () =>
  within(screen.getByRole("group", { name: "Calendar categories" }));
const dayCell = () => day().closest(".calendar-day")!;

it("limits crowded cells while keeping every item in the selected day's details", () => {
  expect(day().getAttribute("aria-label")).toMatch(
    /4 items: Club walk, Cancelled · Club meeting, Thanksgiving Day, UCI Thanksgiving holiday · Starts/,
  );
  expect(dayCell().querySelectorAll(".calendar-item")).toHaveLength(3);
  expect(dayCell().querySelector(".calendar-more")?.textContent).toBe(
    "+1 more",
  );
  expect(
    dayCell().querySelector(".calendar-item.cancelled")?.textContent,
  ).toContain("Cancelled");
  expect(screen.getByRole("heading", { name: "Club walk" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Club meeting" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Thanksgiving Day" })).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "UCI Thanksgiving holiday · Starts" }),
  ).toBeTruthy();
});

it("opens an event directly while preserving the separate date selector and day cards", () => {
  const calendar = within(
    screen.getByRole("group", { name: "Event calendar" }),
  );
  const link = calendar.getByRole("link", { name: "Club walk" });
  const card = screen.getByRole("heading", { name: "Club walk" }).closest("a")!;
  expect(link.getAttribute("href")).toBe("/events/club-walk/1");
  expect(link.getAttribute("href")).toBe(card.getAttribute("href"));
  expect(link.closest("button")).toBeNull();
  expect(
    calendar
      .getByRole("link", { name: "Cancelled · Club meeting" })
      .getAttribute("href"),
  ).toBe("/events/club-meeting/2");

  fireEvent.click(
    calendar.getByRole("button", { name: "November 25, 0 items" }),
  );
  expect(screen.queryByRole("heading", { name: "Club walk" })).toBeNull();
  expect(screen.getByTestId("current-path").textContent).toBe("/events");
  fireEvent.click(day());
  expect(screen.getByRole("heading", { name: "Club walk" })).toBeTruthy();
  fireEvent.click(link);
  expect(screen.getByRole("heading", { name: "Event page" })).toBeTruthy();
  expect(screen.getByTestId("current-path").textContent).toBe(
    "/events/club-walk/1",
  );
});

it("independently filters club events, federal holidays, and UCI dates in cells and details", () => {
  for (const [label, title, remaining] of [
    ["UCI dates", "UCI Thanksgiving holiday", 3],
    ["Events", "Club walk", 2],
    ["Federal holidays", "Thanksgiving Day", 1],
    ["Weekly meeting", "Club meeting", 0],
  ] as const) {
    const toggle = categories().getByRole("button", {
      name: label,
    });
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(day().getAttribute("aria-label")).toContain(
      `${remaining} ${remaining == 1 ? "item" : "items"}`,
    );
    expect(day().getAttribute("aria-label")).not.toContain(title);
    expect(screen.queryByRole("heading", { name: title })).toBeNull();
    expect(screen.queryByRole("link", { name: new RegExp(title) })).toBeNull();
  }
  fireEvent.click(screen.getByRole("button", { name: "Next month" }));
  fireEvent.click(screen.getByRole("button", { name: "Today" }));
  expect(day().getAttribute("aria-label")).toContain("0 items");
  fireEvent.click(screen.getByRole("button", { name: "Show all" }));
  expect(day().getAttribute("aria-label")).toContain("4 items");
  expect(categories().getAllByRole("button", { pressed: true })).toHaveLength(
    6,
  );
});

it("explains an empty calendar when all categories are hidden and lets users recover", () => {
  for (const toggle of categories().getAllByRole("button"))
    fireEvent.click(toggle);
  expect(screen.getByRole("status").textContent).toContain(
    "All categories are hidden",
  );
  expect(day().getAttribute("aria-label")).toContain("0 items");
  fireEvent.click(
    categories().getByRole("button", { name: "Federal holidays" }),
  );
  expect(screen.queryByRole("status")).toBeNull();
  expect(day().getAttribute("aria-label")).toContain(
    "1 item: Thanksgiving Day",
  );
});
