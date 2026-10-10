import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { dateRange, photoURL, useAPI } from "../lib/api";
import { heroImageSizes, staticAssetURL } from "../lib/images";
import { EventCard, Failure, Loading, Panel, Polaroid } from "../components/ui";

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
                sizes={heroImageSizes}
                titleElement="span"
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
                sizes={heroImageSizes}
                titleElement="span"
              />
              <Polaroid
                image="/images/balboa_pier.webp"
                title="Balboa Island"
                caption="January 10, 2026"
                rotation={5}
                sizes={heroImageSizes}
                titleElement="span"
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
              <h3 className="activity-title">{activity.title}</h3>
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
                  titleElement="span"
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
              <img alt="" src={staticAssetURL("/logos/discord.svg")} />
              Discord
            </a>
          )}
          <a
            className="button instagram"
            href="https://www.instagram.com/anteateradventureclub/"
            target="_blank"
            rel="noreferrer"
          >
            <img alt="" src={staticAssetURL("/logos/instagram_white.svg")} />
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
