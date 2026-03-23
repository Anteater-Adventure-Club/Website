import Image from "next/image";
import Link from "next/link";
import "./page.css";

type Retreat = {
  id: string;
  name: string;
  season: string;
  location: string;
  nights: number;
  estMilesFromIrvine: number;
  summary: string;
  story: string;
  highlights: string[];
  images: string[];
};

const retreats: Retreat[] = [
  {
    id: "sequoia",
    name: "Sequoia",
    season: "Fall 2024",
    location: "Sequoia & Kings Canyon National Parks",
    nights: 3,
    estMilesFromIrvine: 250,
    summary:
      "A classic first-quarter reset in giant forest country, with alpine mornings and sunset cookouts.",
    story:
      "We based camp near the foothills and spent our days exploring giant groves, scenic overlooks, and riverside trails. Nights were full of campfire stories, card games, and stargazing after long hikes.",
    highlights: [
      "Sunrise grove walk through giant sequoias",
      "Group cooking night with shared camp meals",
      "Scenic loop hikes and river viewpoints",
    ],
    images: [
      "/images/events/24-25/sequoia.jpg",
      "/images/events/24-25/unknown_hike.jpg",
      "/images/events/24-25/tide_pools.jpg",
      "/images/events/25-26/griffith_park.png",
      "/images/events/25-26/sturtevant_falls.jpeg",
      "/images/events/25-26/hike_mandir.jpeg",
    ],
  },
  {
    id: "death-valley",
    name: "Death Valley",
    season: "Winter 2025",
    location: "Death Valley National Park",
    nights: 2,
    estMilesFromIrvine: 280,
    summary:
      "Wide desert basins, dramatic badlands, and clear skies made this one of our most cinematic retreats.",
    story:
      "This trip balanced long scenic drives with short, high-impact hikes through canyons and salt flats. We explored geological landmarks by day and spent the evenings watching the stars over open desert.",
    highlights: [
      "Golden hour stop at iconic viewpoints",
      "Night sky session far from city lights",
      "Desert geology walk with photo scavenger hunt",
    ],
    images: [
      "/images/events/24-25/death_valley.jpg",
      "/images/events/25-26/balboa_pier.jpg",
      "/images/events/25-26/crystal_cove_beach_walk.jpg",
      "/images/events/24-25/la_city.jpg",
      "/images/events/24-25/san_diego.JPG",
      "/images/events/25-26/oc_zoo.jpg",
    ],
  },
  {
    id: "zion",
    name: "Zion",
    season: "Spring 2025",
    location: "Zion National Park",
    nights: 3,
    estMilesFromIrvine: 430,
    summary:
      "A high-energy quarter-end trip with canyon walls, river trails, and nonstop exploration.",
    story:
      "Zion was our biggest road trip yet. We split into hike crews during the day and regrouped each night for a shared recap dinner at camp, trading route tips and favorite moments.",
    highlights: [
      "Canyon trail loops with multiple route options",
      "Creek-side lunch breaks between hikes",
      "Camp-wide evening recap and planning circle",
    ],
    images: [
      "/images/events/25-26/aac_astro_collab.jpg",
      "/images/events/25-26/aac_ocean_collab.jpg",
      "/images/events/25-26/aldrich_park.jpg",
      "/images/events/25-26/camino_pool.jpg",
      "/images/events/25-26/griffith_park.png",
      "/images/events/25-26/sturtevant_falls.jpeg",
    ],
  },
  {
    id: "central-coast",
    name: "Central Coast",
    season: "Fall 2025",
    location: "California Central Coast",
    nights: 2,
    estMilesFromIrvine: 220,
    summary:
      "Ocean bluffs, coastal trails, and laid-back camp energy made this retreat a club favorite.",
    story:
      "We explored beachside paths, bluff overlooks, and small-town food spots between hikes. The pace was relaxed, with lots of time for group photos, shoreline walks, and board games back at camp.",
    highlights: [
      "Sunset bluff walk and group panorama shots",
      "Coastal loop hike with ocean viewpoints",
      "Beach bonfire-style hangout at dusk",
    ],
    images: [
      "/images/events/25-26/crystal_cove_beach_walk.jpg",
      "/images/events/25-26/balboa_pier.jpg",
      "/images/events/25-26/F25_recap.png",
      "/images/events/25-26/picnic_f25w1.jpg",
      "/images/events/25-26/picnic_f25w3.jpeg",
      "/images/events/24-25/getty_center_and_japanese_food_fest.jpg",
    ],
  },
  {
    id: "joshua-tree",
    name: "Joshua Tree",
    season: "Winter 2026",
    location: "Joshua Tree National Park",
    nights: 3,
    estMilesFromIrvine: 150,
    summary:
      "Boulders, desert trails, and huge skies gave us a perfect mix of challenge and calm.",
    story:
      "Joshua Tree brought a lot of firsts for newer members: first overnight trip, first camp-cooked meals, and first full weekend away with the club. It was equal parts adventure, learning, and community.",
    highlights: [
      "Short scramble routes and rock garden exploration",
      "Desert trail loops for all skill levels",
      "Campfire reflection night and photo recap",
    ],
    images: [
      "/images/events/24-25/AACxUCR_black_star_canyon_falls.jpg",
      "/images/events/24-25/unknown_hike.jpg",
      "/images/events/25-26/hike_mandir.jpeg",
      "/images/events/25-26/oc_zoo.jpg",
      "/images/events/24-25/tide_pools.jpg",
      "/images/events/24-25/sequoia.jpg",
    ],
  },
];

function RetreatImageGrid({
  images,
  retreatName,
  className,
}: {
  images: string[];
  retreatName: string;
  className?: string;
}) {
  return (
    <div className={`retreat-image-grid ${className ?? ""}`}>
      {images.map((src, index) => (
        <figure className="retreat-image-card" key={`${retreatName}-${index}`}>
          <Image
            src={src}
            alt={`${retreatName} retreat photo ${index + 1}`}
            width={640}
            height={480}
          />
        </figure>
      ))}
    </div>
  );
}

export default function Retreats() {
  const totalMiles = retreats.reduce(
    (sum, retreat) => sum + retreat.estMilesFromIrvine,
    0,
  );
  const averageNights =
    retreats.reduce((sum, retreat) => sum + retreat.nights, 0) / retreats.length;

  return (
    <div className="retreats-page">
      <section className="retreats-hero">
        <p className="retreats-kicker">Quarterly Overnight Retreats</p>
        <h1>Where Our Biggest Memories Are Made</h1>
        <p className="retreats-subtitle">
          Every quarter, we head out for a 2-3 night camping retreat with hikes,
          local exploration, and a full weekend of community in the outdoors.
        </p>

        <div className="retreats-stats">
          <article>
            <h3>{retreats.length}</h3>
            <p>Retreat Locations</p>
          </article>
          <article>
            <h3>{retreats.reduce((sum, retreat) => sum + retreat.images.length, 0)}+</h3>
            <p>Dummy Photos on Display</p>
          </article>
          <article>
            <h3>{averageNights.toFixed(1)}</h3>
            <p>Average Nights per Retreat</p>
          </article>
          <article>
            <h3>{totalMiles.toLocaleString()}+</h3>
            <p>Estimated Miles Traveled</p>
          </article>
        </div>
      </section>

      <div className="retreats-timeline">
        {retreats.map((retreat, index) => {
          const firstImageSet = retreat.images.slice(0, 3);
          const secondImageSet = retreat.images.slice(3);
          const isReverse = index % 2 !== 0;

          return (
            <section
              className={`retreat-section ${isReverse ? "retreat-section-reverse" : ""}`}
              key={retreat.id}
            >
              <div className="retreat-header">
                <p className="retreat-season">{retreat.season}</p>
                <h2>{retreat.name}</h2>
                <p>{retreat.location}</p>
              </div>

              <div className="retreat-content-grid">
                {isReverse ? (
                  <>
                    <RetreatImageGrid
                      images={firstImageSet}
                      retreatName={retreat.name}
                      className="retreat-block"
                    />
                    <article className="retreat-text-block retreat-block">
                      <h3>Trip Snapshot</h3>
                      <p>{retreat.summary}</p>
                      <p>{retreat.story}</p>
                    </article>

                    <RetreatImageGrid
                      images={secondImageSet}
                      retreatName={retreat.name}
                      className="retreat-block"
                    />
                    <article className="retreat-text-block retreat-block">
                      <h3>Highlights</h3>
                      <ul>
                        {retreat.highlights.map((highlight) => (
                          <li key={highlight}>{highlight}</li>
                        ))}
                      </ul>
                    </article>
                  </>
                ) : (
                  <>
                    <article className="retreat-text-block retreat-block">
                      <h3>Trip Snapshot</h3>
                      <p>{retreat.summary}</p>
                      <p>{retreat.story}</p>
                    </article>
                    <RetreatImageGrid
                      images={firstImageSet}
                      retreatName={retreat.name}
                      className="retreat-block"
                    />

                    <article className="retreat-text-block retreat-block">
                      <h3>Highlights</h3>
                      <ul>
                        {retreat.highlights.map((highlight) => (
                          <li key={highlight}>{highlight}</li>
                        ))}
                      </ul>
                    </article>
                    <RetreatImageGrid
                      images={secondImageSet}
                      retreatName={retreat.name}
                      className="retreat-block"
                    />
                  </>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <section className="retreats-cta">
        <h2>Join the Next Retreat</h2>
        <p>
          New destination every quarter. New stories every weekend. Camp with us
          and be part of the next chapter.
        </p>
        <div className="retreats-cta-buttons">
          <Link href="/events" className="button cta-button">
            See Upcoming Events
          </Link>
          <Link href="/membership" className="button retreats-secondary-button">
            Become a Member
          </Link>
        </div>
      </section>
    </div>
  );
}
