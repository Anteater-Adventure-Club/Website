"use client";

import Image from "next/image";
import Link from "next/link";
import "./page.css";
import { PolaroidCard } from "@/components/Polaroid/Polaroid";

// Image data for polaroid cards
const hikeImages: AACEvent[] = [
  {
    id: "unknown-hike",
    name: "Unknown Hike",
    date: "Weekly Hikes",
    description:
      "Exploring scenic trails across Orange County and Southern California",
    imagePath: "/images/events/24-25/unknown_hike.jpg",
  },
  {
    id: "laguna-hike",
    name: "Laguna Hike",
    date: "Weekly Hikes",
    description:
      "Exploring scenic trails across Orange County and Southern California",
    imagePath: "/images/events/24-25/laguna_hike.jpg",
  },
];

const cityImages: AACEvent[] = [
  {
    id: "la-city",
    name: "LA Exploration",
    date: "City Exploration",
    description:
      "Adventure isn't just limited to nature — join us on a city exploration",
    imagePath: "/images/events/24-25/la_city.jpg",
  },
  {
    id: "san-diego",
    name: "San Diego Exploration",
    date: "City Exploration",
    description:
      "Adventure isn't just limited to nature — join us on a city exploration",
    imagePath: "/images/events/24-25/san_diego.JPG",
  },
];

const retreatImages: AACEvent[] = [
  {
    id: "death-valley",
    name: "Death Valley",
    date: "Quarterly Retreats",
    description: "Every quarter, the club goes on a weekend retreat",
    imagePath: "/images/events/24-25/death_valley.jpg",
  },
  {
    id: "sequoia",
    name: "Sequoia",
    date: "Quarterly Retreats",
    description: "Every quarter, the club goes on a weekend retreat",
    imagePath: "/images/events/24-25/sequoia.jpg",
  },
];

function Section({
  title,
  description,
  images,
  reverse = false,
}: {
  title: string;
  description: string;
  images: AACEvent[];
  reverse?: boolean;
}) {
  const openPopup = () => {}; // Placeholder - popup functionality can be added later if needed

  return (
    <div className={`section ${reverse ? "reverse" : ""}`}>
      {!reverse && (
        <div className="section-text">
          <h2>{title}</h2>
          <h4>{description}</h4>
        </div>
      )}
      <div className="section-images">
        {images.map((image, index) => (
          <div key={index} className={`section-image-${index}`}>
            <PolaroidCard datum={image} openPopup={openPopup} />
          </div>
        ))}
      </div>
      {reverse && (
        <div className="section-text">
          <h2>{title}</h2>
          <h4>{description}</h4>
        </div>
      )}
    </div>
  );
}

export default function About() {
  return (
    <div className="about">
      {/* Header */}
      <div className="text-center">
        <h1>Our Mission...</h1>
        <h4>
          Fostering a sense of community while making nature as accessible as
          possible!
        </h4>
      </div>

      <div className="sections">
        {/* Hikes */}
        <Section
          title="Hikes"
          description="Explore weekly hikes across Orange County and Southern California — scenic trails, great company, and adventure starting right here at UCI"
          images={hikeImages}
        />

        {/* City Exploration */}
        <Section
          title="City Exploration"
          description="Adventure isn't just limited to nature — join us on a city exploration, where we try new food, explore museums, and feel the rush of a new city"
          images={cityImages}
          reverse={true}
        />

        {/* Quarterly Retreats */}
        <Section
          title="Quarterly Retreats"
          description="Every quarter, the club goes on a weekend retreat, often the highlight of the quarter for many of our members. Past retreat locations include national parks like Sequoia and Death Valley, lakes like Lake Arrowhead, and more!"
          images={retreatImages}
        />
      </div>

      {/* Join CTA */}
      <div className="socials">
        <h2>Join the Club!</h2>
        <h4>
          Our primary form of communication is our club Discord server, but we
          also promote all of our events on our club Instagram.
        </h4>
        <div className="social-buttons">
          <Link
            href="https://discord.gg/YOUR_DISCORD_LINK"
            className="button social-button discord-button"
            target="_blank"
          >
            <Image
              src="/logos/discord.svg"
              alt="Discord Logo"
              width={20}
              height={20}
            />
            Join Discord
          </Link>
          <Link
            href="https://www.instagram.com/anteateradventureclub/"
            className="button social-button instagram-button"
            target="_blank"
          >
            <Image
              src="/logos/instagram_white.svg"
              alt="Instagram Logo"
              width={20}
              height={20}
            />
            Follow on Instagram
          </Link>
        </div>
      </div>
    </div>
  );
}
