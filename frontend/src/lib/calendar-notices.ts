import { uciAcademicDates } from "./uci-academic-dates";

export type CalendarNotice = {
  title: string;
  start: string;
  end: string;
  kind: "federal" | "academic";
  source: string;
};

export const federalHolidaySource =
  "https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/";
export const uciCalendarSource =
  "https://www.reg.uci.edu/navigation/calendars.html";

// UTC arithmetic keeps date-only entries independent of the browser timezone.
function weekday(year: number, month: number, day: number, occurrence: number) {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return 1 + ((day - first + 7) % 7) + (occurrence - 1) * 7;
}

export function calendarNotices(year: number): CalendarNotice[] {
  const notices: CalendarNotice[] = [];
  function holiday(title: string, y: number, month: number, day: number) {
    const date = new Date(Date.UTC(y, month, day));
    const add = (name: string) => {
      const iso = date.toISOString().slice(0, 10);
      if (date.getUTCFullYear() === year)
        notices.push({
          title: name,
          start: iso,
          end: iso,
          kind: "federal",
          source: federalHolidaySource,
        });
    };
    add(title);
    const weekend = date.getUTCDay();
    if (weekend === 0 || weekend === 6) {
      date.setUTCDate(date.getUTCDate() + (weekend === 6 ? -1 : 1));
      add(`${title} (observed)`);
    }
  }
  // Include adjacent years for New Year's Day observed on December 31.
  for (const y of [year - 1, year, year + 1]) {
    holiday("New Year’s Day", y, 0, 1);
    if (y >= 1986)
      holiday("Martin Luther King Jr. Day", y, 0, weekday(y, 0, 1, 3));
    holiday("Presidents’ Day", y, 1, weekday(y, 1, 1, 3));
    const lastMayDay = new Date(Date.UTC(y, 4, 31)).getUTCDay();
    holiday("Memorial Day", y, 4, 31 - ((lastMayDay + 6) % 7));
    if (y >= 2021) holiday("Juneteenth", y, 5, 19);
    holiday("Independence Day", y, 6, 4);
    holiday("Labor Day", y, 8, weekday(y, 8, 1, 1));
    holiday("Indigenous Peoples’ Day", y, 9, weekday(y, 9, 1, 2));
    holiday("Veterans Day", y, 10, 11);
    holiday("Thanksgiving Day", y, 10, weekday(y, 10, 4, 4));
    holiday("Christmas Day", y, 11, 25);
  }
  for (const { source, dates } of uciAcademicDates) {
    for (const [title, start, end = start] of dates) {
      if (start <= `${year}-12-31` && end >= `${year}-01-01`)
        notices.push({ title, start, end, kind: "academic", source });
    }
  }
  return notices.sort((a, b) => a.start.localeCompare(b.start));
}

export function noticesOnDate(notices: CalendarNotice[], date: string) {
  // Long academic ranges get two markers instead of filling every day.
  return notices
    .filter((notice) => notice.start === date || notice.end === date)
    .map((notice) =>
      notice.start === notice.end
        ? notice
        : {
            ...notice,
            title: `${notice.title} · ${notice.start === date ? "Starts" : "Ends"}`,
          },
    );
}
