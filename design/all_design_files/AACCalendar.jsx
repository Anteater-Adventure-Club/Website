// Extension of the design system's UpcomingCalendar (same aac- classes):
// adds a multi-day "Retreat" type and offsets day 1 to its real weekday.
const AAC_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const AAC_LEGEND = [["regular", "Event"], ["weekly-meeting", "Weekly Meeting"], ["potlock-picnic", "Potluck Picnic"], ["retreat", "Retreat"]];
const RETREAT_BG = "var(--officer-parker-bg)", RETREAT_HOVER = "color-mix(in srgb, var(--officer-parker-bg) 70%, var(--officer-parker))";

function aacParseMonth(m) {
  if (m) { const [y, mo] = m.split("-").map(Number); return new Date(y, mo - 1, 1); }
  const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1);
}
const aacDay = (s) => { const d = new Date(s); d.setHours(0, 0, 0, 0); return d.getTime(); };

function AACCalendar({ events = [], initialMonth, today, status, compact = false }) {
  const [display, setDisplay] = React.useState(() => aacParseMonth(initialMonth));
  const [selected, setSelected] = React.useState(null);
  const [hover, setHover] = React.useState(null);
  const t = today ? new Date(today) : new Date();
  const y = display.getFullYear(), m = display.getMonth();
  const monthName = display.toLocaleString("default", { month: "long" });
  const days = new Date(y, m + 1, 0).getDate();
  const lead = new Date(y, m, 1).getDay();
  const eventFor = (day) => { const d = new Date(y, m, day).getTime(); return events.find((e) => d >= aacDay(e.date) && d <= aacDay(e.endDate || e.date)); };
  const shift = (n) => { setSelected(null); setDisplay(new Date(y, m + n, 1)); };
  return (
    <div className="aac-calendar">
      <div className="aac-calendar__header">
        <button type="button" className="aac-month-nav" onClick={() => shift(-1)}>Prev</button>
        <span>{monthName} {y}</span>
        <button type="button" className="aac-month-nav" onClick={() => shift(1)}>Next</button>
      </div>
      <div className="aac-calendar__legend" aria-label="Event type legend">
        {AAC_LEGEND.map(([k, l]) => (
          <div key={k} className="aac-legend-item">
            <span className={"aac-legend-color" + (k === "retreat" ? "" : " event-" + k)} style={k === "retreat" ? { backgroundColor: RETREAT_BG } : undefined} aria-hidden="true" />
            <span>{l}</span>
          </div>
        ))}
      </div>
      {status && <p className="aac-calendar__status">{status}</p>}
      <div className="aac-calendar__weekdays" style={compact ? { gap: "0.35rem", fontSize: "0.75rem" } : undefined}>{AAC_WEEKDAYS.map((d) => <div key={d}>{d}</div>)}</div>
      <div className="aac-calendar__grid" style={compact ? { gap: "0.35rem" } : undefined}>
        {Array.from({ length: lead }, (_, i) => <div key={"b" + i} aria-hidden="true" />)}
        {Array.from({ length: days }, (_, i) => {
          const day = i + 1;
          const ev = eventFor(day);
          const retreat = ev && ev.type === "retreat";
          const isToday = day === t.getDate() && m === t.getMonth() && y === t.getFullYear();
          const cls = "aac-day" + (ev && ev.type && !retreat ? " event-" + ev.type.replace(/\s+/g, "-") : "") + (isToday ? " today" : "");
          const style = { ...(retreat ? { backgroundColor: hover === day ? RETREAT_HOVER : RETREAT_BG } : {}), ...(compact ? { padding: "0.6rem 0", fontSize: "0.85rem" } : {}) };
          return <div key={day} className={cls} style={style} onMouseEnter={() => setHover(day)} onMouseLeave={() => setHover(null)} onClick={() => setSelected(ev || null)}><span>{day}</span></div>;
        })}
      </div>
      {selected && (
        <div className="aac-event-details">
          <h3>{selected.name}</h3>
          <p className="aac-event-details__date">{selected.endDate ? selected.date.replace(/, \d{4}$/, "") + " – " + selected.endDate : selected.date}</p>
          <p className="aac-event-details__desc">{selected.description}</p>
          {selected.signUpLink && <a href={selected.signUpLink}>Sign Up</a>}
        </div>
      )}
    </div>
  );
}
window.AACCalendar = AACCalendar;
