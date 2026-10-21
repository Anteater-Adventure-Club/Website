// Key dates checked against the UCI Registrar on 2026-10-20.
// Extend this data from published calendars; do not extrapolate future terms.
// Fee payment and add/drop deadlines are intentionally excluded from the club calendar.
export const uciAcademicDates: {
  source: string;
  dates: [title: string, start: string, end?: string][];
}[] = [
  {
    source:
      "https://www.reg.uci.edu/calendars/quarterly/2026-2027/quarterly26-27.html",
    dates: [
      ["Fall quarter begins", "2026-09-21"],
      ["Fall instruction begins", "2026-09-24"],
      ["UCI Thanksgiving holiday", "2026-11-26", "2026-11-27"],
      ["Fall instruction ends", "2026-12-04"],
      ["Fall final exams", "2026-12-05", "2026-12-11"],
      ["Fall quarter ends", "2026-12-11"],
      ["Winter break", "2026-12-14", "2027-01-01"],
      ["UCI offices closed", "2026-12-24", "2027-01-01"],
      ["Winter quarter and instruction begin", "2027-01-04"],
      ["Winter instruction ends", "2027-03-12"],
      ["Winter final exams", "2027-03-13", "2027-03-19"],
      ["Winter quarter ends", "2027-03-19"],
      ["Spring break", "2027-03-22", "2027-03-26"],
      ["Spring quarter begins", "2027-03-24"],
      ["UCI Farmworkers Day holiday", "2027-03-26"],
      ["Spring instruction begins", "2027-03-29"],
      ["Spring instruction ends", "2027-06-04"],
      ["Spring final exams", "2027-06-05", "2027-06-10"],
      ["Spring quarter ends", "2027-06-11"],
      ["Commencement", "2027-06-11", "2027-06-14"],
    ],
  },
  {
    source:
      "https://reg.uci.edu/calendars/quarterly/2027-2028/quarterly27-28.html",
    dates: [
      ["Fall quarter begins", "2027-09-20"],
      ["Fall instruction begins", "2027-09-23"],
      ["UCI Thanksgiving holiday", "2027-11-25", "2027-11-26"],
      ["Fall instruction ends", "2027-12-03"],
      ["Fall final exams", "2027-12-04", "2027-12-10"],
      ["Fall quarter ends", "2027-12-10"],
      ["Winter break", "2027-12-13", "2028-01-03"],
      ["UCI offices closed", "2027-12-24", "2028-01-03"],
      ["Winter quarter begins", "2028-01-05"],
      ["Winter instruction begins", "2028-01-10"],
      ["Winter instruction ends", "2028-03-17"],
      ["Winter final exams", "2028-03-18", "2028-03-24"],
      ["Winter quarter ends", "2028-03-24"],
      ["Spring break", "2028-03-27", "2028-03-31"],
      ["Spring quarter begins", "2028-03-29"],
      ["UCI Farmworkers Day holiday", "2028-03-31"],
      ["Spring instruction begins", "2028-04-03"],
      ["Spring instruction ends", "2028-06-09"],
      ["Spring final exams", "2028-06-10", "2028-06-15"],
      ["Spring quarter ends", "2028-06-16"],
      ["Commencement", "2028-06-16", "2028-06-19"],
    ],
  },
];
