import { useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import { ArrowRight, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import {
  dateLabel,
  dateRange,
  pacificDate,
  photoURL,
  useAPI,
} from "../lib/api";
import type { Schema } from "../lib/api";
import { staticAssetURL } from "../lib/images";
import { useIdentity } from "../lib/context";
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
  const initial = pacificDate().split("-").map(Number);
  const [month, setMonth] = useState({
    year: initial[0],
    month: initial[1] - 1,
  });
  const [selected, setSelected] = useState(pacificDate());
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
  const activity = params.get("activity");
  const all = (events.data?.items || []).filter((e) =>
    !activity || activity === "retreat"
      ? !activity || e.kind === "retreat"
      : activity === "meeting"
        ? ["meeting", "picnic"].includes(e.kind)
        : activity === "beach"
          ? /beach|tide|coast|creek|laguna|pier/i.test(e.name + e.destination)
          : activity === "city"
            ? /city|los angeles|san diego|balboa/i.test(e.name + e.destination)
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
        </div>
        <div className="calendar-legend">
          <span className="regular">Event</span>
          <span className="meeting">Weekly meeting</span>
          <span className="picnic">Potluck picnic</span>
          <span className="retreat">Retreat</span>
        </div>
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
              return (
                <button
                  key={day}
                  className={`calendar-day ${rows[0]?.kind || ""} ${rows.every((e) => e.state === "cancelled") && rows.length ? "cancelled" : ""} ${selected === day ? "selected" : ""}`}
                  aria-pressed={selected === day}
                  aria-label={`${dateLabel(day, { month: "long", day: "numeric" })}, ${rows.length} events`}
                  onClick={() => setSelected(day)}
                >
                  <span>{i + 1}</span>
                  <div className="calendar-day-events">
                    {rows.map((e) => (
                      <span key={e.id}>{e.name}</span>
                    ))}
                  </div>
                  {rows.length > 1 && (
                    <small className="event-count">{rows.length} events</small>
                  )}
                </button>
              );
            })}
          </div>
        )}
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
        {events.isPending ? (
          <Loading />
        ) : onDay(selected).length ? (
          <div className="card-grid">
            {onDay(selected).map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        ) : (
          <Panel>
            <p>No adventures on this date. Pick another day to explore.</p>
          </Panel>
        )}
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
          <Link className="button primary" to="/my-aac">
            Continue to My AAC
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
