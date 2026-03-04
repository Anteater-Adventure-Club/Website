"use client";

import Image from "next/image";
import Link from "next/link";
import "./page.css";
import { PolaroidCard } from "@/components/PolaroidCard/PolaroidCard";

// TODO: consider replacing hike/city with just "weekend event"

// Image data for polaroid cards
const hikeImages: AACEvent[] = [
  {
    id: "salt-creek-hike",
    name: "Salt Creek Trail Hike @ Dana Point",
    date: "Winter 2024",
    description: "",
    imagePath: "/images/events/24-25/unknown_hike.jpg",
  },
  {
    id: "tide-pools",
    name: "Laguna Tide Pools Hike",
    date: "Winter 2026",
    description: "",
    imagePath: "/images/events/24-25/tide_pools.jpg",
  },
];

const cityImages: AACEvent[] = [
  {
    id: "la-city",
    name: "LA Grand Central Market",
    date: "Winter 2025",
    description: "",
    imagePath: "/images/events/24-25/la_city.jpg",
  },
  {
    id: "san-diego",
    name: "San Diego Exploration",
    date: "Spring 2025",
    description: "",
    imagePath: "/images/events/24-25/san_diego.JPG",
  },
];

const picnicImages: AACEvent[] = [
  {
    id: "la-city",
    name: "Potluck Picnic",
    date: "Fall 2025 Week 1",
    description: "",
    imagePath: "/images/events/25-26/picnic_f25w1.jpg",
  },
  {
    id: "san-diego",
    name: "Potluck Picnic",
    date: "Fall 2025 Week 3",
    description: "",
    imagePath: "/images/events/25-26/picnic_f25w3.jpeg",
  },
];

const retreatImages: AACEvent[] = [
  {
    id: "death-valley",
    name: "Death Valley National Park",
    date: "Winter 2025 Retreat",
    description: "",
    imagePath: "/images/events/24-25/death_valley.jpg",
  },
  {
    id: "sequoia",
    name: "Sequoia & Kings Canyon National Parks",
    date: "Fall 2024 Retreat",
    description: "",
    imagePath: "/images/events/24-25/sequoia.jpg",
  },
];

function Section({
  title,
  description,
  images,
}: {
  title: string;
  description: string;
  images: AACEvent[];
}) {
  const openPopup = () => {}; // Placeholder; TODO: replace this

  return (
    <div className="section">
      <div className="section-text">
        <h2>{title}</h2>
        <h4>{description}</h4>
      </div>
      <div className="section-images">
        {images.map((image, index) => (
          <div key={index} className={`section-image-${index}`}>
            <PolaroidCard datum={image} openPopup={openPopup} />
          </div>
        ))}
      </div>
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
        <Section
          title="Hikes"
          description="Explore weekly hikes across Orange County and Southern California — scenic trails, great company, and adventure starting right here at UCI"
          images={hikeImages}
        />
        <Section
          title="City Exploration"
          description="Adventure isn't just limited to nature — join us on a city exploration, where we try new food, explore museums, and feel the rush of a new city"
          images={cityImages}
        />
        <Section
          title="Potluck Picnics"
          description="Enjoy a nice day outside at our potluck picnics, featuring games, food, and sports, every week in Aldrich Park!"
          images={picnicImages}
        />
        <Section
          title="Quarterly Retreats"
          description="Every quarter, the club goes on a weekend retreat, often the highlight of the quarter for many of our members. Past retreat locations include national parks like Sequoia and Death Valley, lakes like Lake Arrowhead, and more!"
          images={retreatImages}
        />
      </div>

      {/* Join CTA */}
      <div className="socials">
        <h2>Join the Adventure!</h2>
        <h4>
          Our primary form of communication is our club Discord server, but we
          also promote all of our events on our club Instagram.
        </h4>
        <div className="social-buttons">
          <Link
            href="https://discord.com/invite/F7FqKQushk"
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
