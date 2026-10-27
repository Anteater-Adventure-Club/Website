import { needsApproval } from "../lib/approval";
import { useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Minus,
} from "lucide-react";
import {
  dateLabel,
  dateRange,
  eventURL,
  pacificDate,
  photoURL,
  useAPI,
} from "../lib/api";
import type { Schema } from "../lib/api";
import { staticAssetURL } from "../lib/images";
import { useIdentity } from "../lib/context";
import {
  calendarNotices,
  federalHolidaySource,
  noticesOnDate,
  uciCalendarSource,
} from "../lib/calendar-notices";
import {
  Button,
  Dialog,
  EventCard,
  Failure,
  Loading,
  Panel,
  Pill,
  Polaroid,
} from "../components/ui";

const calendarCategories = [
  { kind: "regular", label: "Events" },
  { kind: "meeting", label: "Weekly meeting" },
  { kind: "picnic", label: "Potluck picnic" },
  { kind: "retreat", label: "Retreat" },
  { kind: "federal", label: "Federal holidays" },
  { kind: "academic", label: "UCI dates" },
] as const;
type CalendarCategory = (typeof calendarCategories)[number]["kind"];

function GalleryDialog({
  row,
  onClose,
}: {
  row: Schema<"GalleryRow">;
  onClose: () => void;
}) {
  return (
    <Dialog title={row.title || row.event_name} onClose={onClose}>
      <img
        className="dialog-photo"
        src={photoURL(row.image_id, false, "large")}
        alt={row.caption || row.event_name}
      />
      <p className="muted">
        {dateRange(row.starts_at, row.ends_at, {
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
      </p>
      <p>{row.caption}</p>
      <p className="preserve-lines">{row.text}</p>
      <Link
        to={`/events/event/${row.event_id}`}
        className="button secondary"
        onClick={onClose}
      >
        View event
      </Link>
    </Dialog>
  );
}

export function Events() {
  const [params] = useSearchParams();
  const today = pacificDate();
  const initial = today.split("-").map(Number);
  const [month, setMonth] = useState({
    year: initial[0],
    month: initial[1] - 1,
  });
  const [selected, setSelected] = useState(today);
  const [hiddenCategories, setHiddenCategories] = useState<CalendarCategory[]>(
    [],
  );
  const isVisible = (kind: CalendarCategory) =>
    !hiddenCategories.includes(kind);
  const [galleryRow, setGalleryRow] = useState<Schema<"GalleryRow"> | null>(
    null,
  );
  const first = new Date(Date.UTC(month.year, month.month, 1));
  const last = new Date(Date.UTC(month.year, month.month + 1, 0));
  const iso = (day: number) =>
    `${month.year}-${String(month.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const events = useAPI(
    "Page_EventPublic_",
    `/api/events?from=${iso(1)}&to=${iso(last.getUTCDate())}&limit=200`,
  );
  const gallery = useAPI("Page_GalleryRow_", "/api/gallery?limit=100");
  const notices = calendarNotices(month.year).filter((notice) =>
    isVisible(notice.kind),
  );
  const selectedNotices = noticesOnDate(notices, selected);
  const activity = params.get("activity");
  const all = (events.data?.items || [])
    .filter((e) => isVisible(e.kind))
    .filter((e) =>
      !activity || activity === "retreat"
        ? !activity || e.kind === "retreat"
        : activity === "meeting"
          ? ["meeting", "picnic"].includes(e.kind)
          : activity === "beach"
            ? /beach|tide|coast|creek|laguna|pier/i.test(e.name + e.destination)
            : activity === "city"
              ? /city|los angeles|san diego|balboa/i.test(
                  e.name + e.destination,
                )
              : true,
    );
  const onDay = (day: string) =>
    all.filter(
      (e) =>
        pacificDate(new Date(e.starts_at)) <= day &&
        pacificDate(new Date(e.ends_at)) >= day,
    );
  const recurring = [
    ...new Map(
      all.filter((e) => e.series_id).map((e) => [e.series_id, e]),
    ).values(),
  ];
  function shift(delta: number) {
    const next = new Date(Date.UTC(month.year, month.month + delta, 1));
    setMonth({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
    setSelected(
      `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01`,
    );
  }
  function goToToday() {
    const date = pacificDate();
    const [year, month] = date.split("-").map(Number);
    setMonth({ year, month: month - 1 });
    setSelected(date);
  }
  return (
    <div className="page events-page">
      <div className="center-heading">
        <h1>Stay up to date!</h1>
        <p>Tap any date or past event to learn more!</p>
      </div>
      {activity && (
        <div className="notice">
          Showing {activity} adventures.{" "}
          <Link to="/events">See all activities</Link>
        </div>
      )}
      <h2 className="center-heading">Upcoming events</h2>
      <Panel className="calendar-panel">
        <div className="calendar-heading">
          <Button
            variant="secondary"
            aria-label="Previous month"
            onClick={() => shift(-1)}
          >
            <ChevronLeft size={18} />
          </Button>
          <h3>
            {new Intl.DateTimeFormat("en-US", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            }).format(first)}
          </h3>
          <Button
            variant="secondary"
            aria-label="Next month"
            onClick={() => shift(1)}
          >
            <ChevronRight size={18} />
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="calendar-today"
            onClick={goToToday}
          >
            Today
          </Button>
        </div>
        <div
          className="calendar-legend"
          role="group"
          aria-label="Calendar categories"
        >
          {calendarCategories.map(({ kind, label }) => (
            <button
              type="button"
              key={kind}
              className={`calendar-filter ${kind}`}
              aria-pressed={isVisible(kind)}
              onClick={() =>
                setHiddenCategories((hidden) =>
                  hidden.includes(kind)
                    ? hidden.filter((item) => item !== kind)
                    : [...hidden, kind],
                )
              }
            >
              {isVisible(kind) ? (
                <Check size={13} aria-hidden="true" />
              ) : (
                <Minus size={13} aria-hidden="true" />
              )}
              {label}
            </button>
          ))}
        </div>
        <div className="calendar-filter-help">
          <span>
            Tap a category to show or hide it. Select a date for details.
            <span className="calendar-link-help">
              {" "}
              Select an event → to open its page.
            </span>
          </span>
          {hiddenCategories.length > 0 && (
            <button type="button" onClick={() => setHiddenCategories([])}>
              Show all
            </button>
          )}
        </div>
        {hiddenCategories.length === calendarCategories.length && (
          <p className="notice" role="status">
            All categories are hidden. Turn one on or choose Show all.
          </p>
        )}
        {events.error ? (
          <Failure error={events.error} retry={events.refetch} />
        ) : (
          <div className="calendar" role="group" aria-label="Event calendar">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <span className="weekday" key={d}>
                {d}
              </span>
            ))}
            {Array.from({ length: first.getUTCDay() }, (_, i) => (
              <span key={`empty-${i}`} />
            ))}
            {Array.from({ length: last.getUTCDate() }, (_, i) => {
              const day = iso(i + 1);
              const rows = onDay(day);
              const referenceDates = noticesOnDate(notices, day);
              const items = [
                ...rows.map((event) => ({
                  id: `event-${event.id}`,
                  title:
                    event.state === "cancelled"
                      ? `Cancelled · ${event.name}`
                      : event.name,
                  kind: event.kind,
                  cancelled: event.state === "cancelled",
                  href: eventURL(event),
                })),
                ...referenceDates.map((notice) => ({
                  id: `${notice.kind}-${notice.start}-${notice.title}`,
                  title: notice.title,
                  kind: notice.kind,
                  cancelled: false,
                  href: null,
                })),
              ];
              const shown = items.slice(0, 3);
              return (
                <div
                  key={day}
                  className={`calendar-day ${items.length === 1 ? "single-item" : ""} ${selected === day ? "selected" : ""}`}
                >
                  <button
                    type="button"
                    className="calendar-day-select"
                    aria-current={day === today ? "date" : undefined}
                    aria-pressed={selected === day}
                    aria-label={`${dateLabel(day, { month: "long", day: "numeric" })}, ${items.length} ${items.length === 1 ? "item" : "items"}${items.length ? `: ${items.map((item) => item.title).join(", ")}` : ""}`}
                    onClick={() => setSelected(day)}
                  >
                    <span className="calendar-day-number">{i + 1}</span>
                  </button>
                  <span className="calendar-day-events">
                    {shown.map((item) => {
                      const className = `calendar-item ${item.kind} ${item.cancelled ? "cancelled" : ""}`;
                      return item.href ? (
                        <Link
                          to={item.href}
                          className={`${className} calendar-event-link`}
                          key={item.id}
                          title={`View event: ${item.title}`}
                        >
                          <span className="calendar-event-title">
                            {item.title}
                          </span>
                          <ArrowRight size={10} aria-hidden="true" />
                        </Link>
                      ) : (
                        <span
                          className={className}
                          key={item.id}
                          title={item.title}
                          aria-hidden="true"
                        >
                          {item.title}
                        </span>
                      );
                    })}
                  </span>
                  <span className="calendar-day-dots" aria-hidden="true">
                    {shown.map((item) => (
                      <span
                        className={`calendar-dot ${item.kind} ${item.cancelled ? "cancelled" : ""}`}
                        key={item.id}
                      />
                    ))}
                  </span>
                  {items.length > shown.length && (
                    <small className="calendar-more" aria-hidden="true">
                      +{items.length - shown.length}
                      <span> more</span>
                    </small>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <p className="calendar-source-note muted">
          <a href={federalHolidaySource} target="_blank" rel="noreferrer">
            U.S. federal holidays
          </a>
          {" · "}
          <a href={uciCalendarSource} target="_blank" rel="noreferrer">
            Key UCI dates: Fall 2026–Spring 2028
          </a>
        </p>
      </Panel>
      <section className="section">
        <div className="section-heading">
          <h2>
            {dateLabel(selected, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </h2>
          <span className="muted">Pacific time</span>
        </div>
        {selectedNotices.length > 0 && (
          <Panel className="calendar-notices">
            <ul className="calendar-notice-list">
              {selectedNotices.map((notice) => (
                <li key={`${notice.kind}-${notice.start}-${notice.title}`}>
                  <a href={notice.source} target="_blank" rel="noreferrer">
                    {notice.title}
                  </a>
                  <small className="muted">
                    {notice.kind === "federal"
                      ? "U.S. federal holiday"
                      : "UCI academic date"}
                    {notice.start !== notice.end &&
                      ` · ${dateLabel(notice.start, { month: "short", day: "numeric", year: "numeric" })} – ${dateLabel(notice.end, { month: "short", day: "numeric", year: "numeric" })}`}
                  </small>
                </li>
              ))}
            </ul>
          </Panel>
        )}
        {events.isPending ? (
          <Loading />
        ) : onDay(selected).length ? (
          <div className="card-grid">
            {onDay(selected).map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        ) : !selectedNotices.length ? (
          <Panel>
            <p>
              No visible events or dates. Pick another day or adjust the
              categories above.
            </p>
          </Panel>
        ) : null}
      </section>
      {recurring.length > 0 && (
        <section className="section">
          <h2>Every week!</h2>
          <div className="card-grid">
            {recurring.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}
      <section className="section">
        <div className="center-heading">
          <h2>Past adventures</h2>
          <p>A few memories from the trail.</p>
        </div>
        {gallery.isPending ? (
          <Loading />
        ) : gallery.error ? (
          <Failure error={gallery.error} retry={gallery.refetch} />
        ) : gallery.data?.items.length ? (
          <div className="gallery-grid">
            {gallery.data.items.map((p, i) => (
              <Polaroid
                key={p.event_id}
                image={photoURL(p.image_id)}
                title={p.title || p.event_name}
                caption={dateRange(p.starts_at, p.ends_at)}
                rotation={i % 2 ? 2 : -2}
                onClick={() => setGalleryRow(p)}
              />
            ))}
          </div>
        ) : (
          <Panel className="empty">
            <p>Our photo gallery will grow with our adventures.</p>
          </Panel>
        )}
      </section>
      {galleryRow && (
        <GalleryDialog row={galleryRow} onClose={() => setGalleryRow(null)} />
      )}
    </div>
  );
}

function BoardTerm({
  id,
  compact = false,
}: {
  id?: number;
  compact?: boolean;
}) {
  const query = useAPI("BoardView", `/api/board${id ? `?term_id=${id}` : ""}`);
  const [selected, setSelected] = useState<Schema<"BoardEntryPublic"> | null>(
    null,
  );
  if (query.isPending) return <Loading />;
  if (query.error) return <Failure error={query.error} retry={query.refetch} />;
  return (
    <>
      <div className={compact ? "prior-board-grid" : "board-grid"}>
        {query.data?.entries.map((entry, i) =>
          compact ? (
            <button
              className="board-name"
              key={entry.id}
              onClick={() => setSelected(entry)}
            >
              <strong>{entry.name}</strong>
              <small>{entry.role}</small>
            </button>
          ) : (
            <Polaroid
              key={entry.id}
              title={entry.name}
              titleElement="h2"
              caption={entry.role}
              image={
                entry.photo_id
                  ? photoURL(entry.photo_id)
                  : staticAssetURL("/images/board-placeholder.svg")
              }
              rotation={i % 2 ? 1 : -1}
              onClick={() => setSelected(entry)}
            />
          ),
        )}
      </div>
      {!query.data?.entries.length && (
        <Panel className="empty">
          <p>Meet the board soon. Officer profiles are being prepared.</p>
        </Panel>
      )}
      {selected && (
        <Dialog title={selected.name} onClose={() => setSelected(null)}>
          <div className={`board-profile ${selected.palette}`}>
            <img
              src={
                selected.photo_id
                  ? photoURL(selected.photo_id)
                  : staticAssetURL("/images/board-placeholder.svg")
              }
              alt={selected.name}
            />
            <Pill>{selected.role}</Pill>
            <p>{selected.major}</p>
            <p className="preserve-lines">{selected.bio}</p>
            {selected.memory && (
              <>
                <h3>Favorite AAC memory</h3>
                <p>{selected.memory}</p>
              </>
            )}
            {selected.instagram && (
              <a
                className="button secondary"
                href={selected.instagram}
                target="_blank"
                rel="noreferrer"
              >
                Instagram <ArrowRight size={16} />
              </a>
            )}
          </div>
        </Dialog>
      )}
    </>
  );
}

export function Board() {
  const terms = useAPI("Items_BoardTermView_", "/api/board/terms");
  const current = terms.data?.items.find((t) => t.current);
  const previous = terms.data?.items.filter((t) => !t.current) || [];
  const [older, setOlder] = useState("");
  return (
    <div className="page board-page">
      <div className="center-heading">
        <h1>Meet the board!</h1>
        <p>Here to turn more days into adventures.</p>
        {current && <Pill>{current.label}</Pill>}
      </div>
      <BoardTerm />
      {previous[0] && (
        <details className="panel previous-board" open>
          <summary>{previous[0].label}</summary>
          <BoardTerm id={previous[0].id} compact />
        </details>
      )}
      {previous.length > 1 && (
        <section className="section">
          <label className="field">
            Previous boards
            <select value={older} onChange={(e) => setOlder(e.target.value)}>
              <option value="">Choose a board year</option>
              {previous.slice(1).map((t) => (
                <option value={t.id} key={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          {older && (
            <Panel>
              <BoardTerm id={Number(older)} compact />
            </Panel>
          )}
        </section>
      )}
    </div>
  );
}

export function SignIn() {
  const { session } = useIdentity();
  const [params] = useSearchParams();
  const error = params.get("error");
  const returnTo = encodeURIComponent(params.get("return_to") || "/my-aac");
  const messages: Record<string, string> = {
    uci: "Use your verified UCI Google account. If you don’t have a UCI email, choose the option below.",
    google: "Use a Google account with a verified email address.",
    oauth: "We could not finish signing you in. Please try again.",
    unconfigured:
      "Google sign-in is being configured. You can browse public events in the meantime.",
  };
  return (
    <div className="page sign-in-page">
      <div className="hero-polaroids">
        <Polaroid
          image="/images/sequoia.webp"
          title="Sequoia"
          titleElement="span"
          rotation={-5}
        />
        <Polaroid
          titleElement="span"
          image="/images/death_valley.webp"
          title="Death Valley"
          rotation={5}
        />
      </div>
      <Panel>
        <h1>Sign in!</h1>
        <p>Join events, coordinate rides, and manage your membership.</p>
        {error && (
          <div className="notice error" role="alert">
            {messages[error] || messages.oauth}
          </div>
        )}
        {session?.member ? (
          <Link
            className="button primary"
            to={
              needsApproval(session.member) ? "/my-aac/application" : "/my-aac"
            }
          >
            {needsApproval(session.member)
              ? "View your application"
              : "Continue to My AAC"}
          </Link>
        ) : (
          <>
            <a
              className="button primary google-button"
              href={`/api/auth/login?return_to=${returnTo}`}
            >
              <span className="google-g" aria-hidden="true">
                G
              </span>
              Continue with UCI Google
            </a>
            <a
              className="button quiet"
              href={`/api/auth/login?mode=non_uci&return_to=${returnTo}`}
            >
              I don't have a UCI email
            </a>
            <small className="muted">
              New non-UCI members complete an application for officer approval.
            </small>
          </>
        )}
        <Link className="text-link" to="/events">
          Browse events without signing in <ArrowRight size={16} />
        </Link>
      </Panel>
    </div>
  );
}

export function NotFound() {
  const location = useLocation();
  return (
    <div className="page not-found">
      <MapPin size={48} aria-hidden="true" />
      <h1>A little off the trail!</h1>
      <p>
        We couldn’t find {location.pathname}. Let’s get you back to an
        adventure.
      </p>
      <div className="actions centered">
        <Link className="button primary" to="/">
          Head Home
        </Link>
        <Link className="button secondary" to="/events">
          Explore Events
        </Link>
      </div>
    </div>
  );
}
