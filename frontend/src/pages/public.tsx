import { useEffect, useState } from "react";
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

export function Home() {
  const home = useAPI("HomeView", "/api/home");
  const settings = useAPI("SiteSettings", "/api/site-settings");
  const polaroids = home.data?.polaroids || [];
  const [rotation, setRotation] = useState(0);
  const [prefersReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    if (polaroids.length < 2 || prefersReducedMotion) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setRotation((i) => (i + 1) % polaroids.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [polaroids.length, prefersReducedMotion]);
  const activities = [
    {
      title: "Hikes",
      text: "Explore weekly hikes across Orange County and Southern California — scenic trails, great company, and adventure starting right here at UCI",
      images: ["about_salt_creek", "about_tide_pools"],
      labels: ["Salt Creek Trail Hike @ Dana Point", "Laguna Tide Pools Hike"],
      dates: ["Winter 2024", "Winter 2026"],
    },
    {
      title: "City Exploration",
      text: "Adventure isn't just limited to nature — join us on a city exploration, where we try new food, explore museums, and feel the rush of a new city",
      images: ["about_la_city", "about_san_diego"],
      labels: ["LA Grand Central Market", "San Diego Exploration"],
      dates: ["Winter 2025", "Spring 2025"],
    },
    {
      title: "Potluck Picnics",
      text: "Enjoy a nice day outside at our potluck picnics, featuring games, food, and sports, every week in Aldrich Park!",
      images: ["gallery_picnic_f25w1", "about_picnic_w3"],
      labels: ["Potluck Picnic", "Potluck Picnic"],
      dates: ["Fall 2025 Week 1", "Fall 2025 Week 3"],
    },
    {
      title: "Quarterly Retreats",
      text: "Every quarter, the club goes on a weekend retreat, often the highlight of the quarter for many of our members. Past retreat locations include national parks like Sequoia and Death Valley, lakes like Lake Arrowhead, and more!",
      images: ["about_death_valley", "about_sequoia"],
      labels: [
        "Death Valley National Park",
        "Sequoia & Kings Canyon National Parks",
      ],
      dates: ["Winter 2025 Retreat", "Fall 2024 Retreat"],
    },
  ];
  return (
    <div className="page home-page">
      <section className="hero">
        <div>
          <h1>
            <span>Anteater</span>
            <br />
            Adventure Club
          </h1>
          <p>
            Fostering a sense of community while making nature as accessible as
            possible!
          </p>
          <Link className="button primary heading-button" to="/events">
            Join the adventure! <ArrowRight size={18} />
          </Link>
        </div>
        <div
          key={rotation}
          className={`hero-polaroids${rotation > 0 && !prefersReducedMotion ? " photos-rotating" : ""}`}
        >
          {polaroids.length ? (
            [
              polaroids[rotation % polaroids.length],
              ...(polaroids.length > 1
                ? [polaroids[(rotation + 1) % polaroids.length]]
                : []),
            ].map((p, i) => (
              <Polaroid
                key={p.event_id}
                image={photoURL(p.image_id)}
                title={p.title || p.event_name}
                caption={dateRange(p.starts_at, p.ends_at, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
                rotation={i ? 5 : -5}
                eager={i === 0}
              />
            ))
          ) : (
            <>
              <Polaroid
                image="/images/griffith_park.webp"
                title="Griffith Park/Observatory Day Trip"
                caption="November 2, 2025"
                rotation={-5}
                eager
              />
              <Polaroid
                image="/images/balboa_pier.webp"
                title="Balboa Island"
                caption="January 10, 2026"
                rotation={5}
              />
            </>
          )}
        </div>
      </section>
      <section className="section">
        <div className="section-heading">
          <h2>Coming up!</h2>
          <Link to="/events">
            Calendar <ArrowRight size={15} />
          </Link>
        </div>
        {home.isPending ? (
          <Loading />
        ) : home.error ? (
          <Failure error={home.error} retry={home.refetch} />
        ) : home.data?.upcoming.length ? (
          <div className="card-grid">
            {home.data.upcoming.slice(0, 3).map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        ) : (
          <Panel>
            <p>
              Our next adventures are on the way. Check back for dates, or come
              meet the club.
            </p>
            <Link to="/membership">
              Get to know AAC <ArrowRight size={16} />
            </Link>
          </Panel>
        )}
      </section>
      <section className="section activities">
        <div className="center-heading">
          <h2>What we do!</h2>
          <p>
            Weekly activities are completely free! Membership is only necessary
            for the quarterly retreat.
          </p>
        </div>
        {activities.map((activity, index) => (
          <div
            className={`activity-row ${index % 2 ? "reverse" : ""}`}
            key={activity.title}
          >
            <div className="activity-copy">
              <h2>{activity.title}</h2>
              <p>{activity.text}</p>
              <Link to="/events">
                Find your next adventure <ArrowRight size={16} />
              </Link>
            </div>
            <div className="activity-polaroids">
              {activity.images.map((image, i) => (
                <Polaroid
                  key={image}
                  image={`/images/${image}.webp`}
                  title={activity.labels[i]}
                  caption={activity.dates[i]}
                  rotation={i ? 3 : -3}
                />
              ))}
            </div>
          </div>
        ))}
      </section>
      <section className="section center-heading">
        <h2>Join the adventure!</h2>
        <p>
          Our primary form of communication is our club Discord server, but we
          also promote all of our events on our club Instagram.
        </p>
        <div className="actions centered">
          {settings.data?.discord && (
            <a
              className="button discord"
              href={settings.data.discord}
              target="_blank"
              rel="noreferrer"
            >
              <img alt="" src="/logos/discord.svg" />
              Discord
            </a>
          )}
          <a
            className="button instagram"
            href="https://www.instagram.com/anteateradventureclub/"
            target="_blank"
            rel="noreferrer"
          >
            <img alt="" src="/logos/instagram_white.svg" />
            Instagram
          </a>
        </div>
      </section>
      <Panel className="membership-cta">
        <div>
          <h2>Become a member!</h2>
          <p>
            Weekly activities are always free. Paid membership supports rides,
            retreats, and the community we build together.
          </p>
          <Link className="button primary" to="/membership">
            Explore membership
          </Link>
        </div>
        <div className="price-block">
          <strong>$25</strong>
          <span>per quarter · UCI students</span>
          <small>$30 for non-students</small>
        </div>
      </Panel>
    </div>
  );
}

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
              caption={entry.role}
              image={
                entry.photo_id
                  ? photoURL(entry.photo_id)
                  : "/images/board-placeholder.svg"
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
                  : "/images/board-placeholder.svg"
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
        <Polaroid image="/images/sequoia.webp" title="Sequoia" rotation={-5} />
        <Polaroid
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
