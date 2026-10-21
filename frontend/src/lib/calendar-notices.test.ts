import { describe, expect, it } from "vitest";
import { calendarNotices, noticesOnDate } from "./calendar-notices";

const titles = (year: number, date: string) =>
  noticesOnDate(calendarNotices(year), date).map((notice) => notice.title);

describe("federal holiday dates", () => {
  it("places weekday-based holidays on the correct 2026 dates", () => {
    expect(titles(2026, "2026-01-19")).toContain("Martin Luther King Jr. Day");
    expect(titles(2026, "2026-02-16")).toContain("Presidents’ Day");
    expect(titles(2026, "2026-05-25")).toContain("Memorial Day");
    expect(titles(2026, "2026-09-07")).toContain("Labor Day");
    expect(titles(2026, "2026-10-12")).toContain("Indigenous Peoples’ Day");
    expect(titles(2026, "2026-11-26")).toContain("Thanksgiving Day");
  });

  it("keeps actual holidays and labels weekend observances separately", () => {
    expect(titles(2026, "2026-07-03")).toContain("Independence Day (observed)");
    expect(titles(2026, "2026-07-04")).toContain("Independence Day");
    expect(titles(2027, "2027-07-05")).toContain("Independence Day (observed)");
    expect(titles(2027, "2027-12-31")).toContain("New Year’s Day (observed)");
  });

  it("includes each federal date once and does not backdate newer holidays", () => {
    const holidays = calendarNotices(2030).filter(
      (notice) => notice.kind === "federal",
    );
    expect(
      new Set(holidays.map((notice) => `${notice.start}:${notice.title}`)).size,
    ).toBe(holidays.length);
    expect(
      calendarNotices(2020).some((notice) => notice.title === "Juneteenth"),
    ).toBe(false);
  });
});

describe("published UCI academic dates", () => {
  it("excludes fee payment and add/drop deadlines from every published academic year", () => {
    for (const year of [2026, 2027, 2028]) {
      expect(
        calendarNotices(year).some((notice) =>
          /fee payment|add\/drop/i.test(notice.title),
        ),
      ).toBe(false);
    }
  });

  it("shows labeled start/end markers without repeating ranges on interior dates", () => {
    for (const notice of calendarNotices(2026).filter(
      (n) => n.start !== n.end,
    )) {
      expect(titles(2026, notice.start)).toContain(`${notice.title} · Starts`);
      const endYear = Number(notice.end.slice(0, 4));
      expect(titles(endYear, notice.end)).toContain(`${notice.title} · Ends`);
      const interior = new Date(`${notice.start}T00:00:00Z`);
      interior.setUTCDate(interior.getUTCDate() + 1);
      if (interior.toISOString().slice(0, 10) < notice.end) {
        expect(
          noticesOnDate([notice], interior.toISOString().slice(0, 10)),
        ).toEqual([]);
      }
    }
    expect(titles(2026, "2026-12-12")).not.toContain("Fall final exams · Ends");
    expect(titles(2027, "2027-01-02")).not.toContain("Winter break · Ends");
  });

  it("keeps the full range on markers and leaves the source data unchanged", () => {
    const notices = calendarNotices(2027);
    const end = noticesOnDate(notices, "2027-01-01").find(
      (n) => n.title === "Winter break · Ends",
    );
    expect(end).toMatchObject({ start: "2026-12-14", end: "2027-01-01" });
    expect(notices.find((n) => n.title === "Winter break")).toBeDefined();
  });

  it("preserves UCI's different quarter-start and instruction-start dates", () => {
    expect(titles(2028, "2028-01-05")).toContain("Winter quarter begins");
    expect(titles(2028, "2028-01-10")).toContain("Winter instruction begins");
    expect(titles(2027, "2027-06-11")).toContain("Spring quarter ends");
    expect(titles(2027, "2027-06-11")).not.toContain("Spring final exams");
  });

  it("does not invent academic dates outside the published data", () => {
    expect(
      calendarNotices(2030).some((notice) => notice.kind === "academic"),
    ).toBe(false);
  });
});
