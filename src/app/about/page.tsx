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
  linkHref,
  linkLabel,
}: {
  title: string;
  description: string;
  images: AACEvent[];
  linkHref?: string;
  linkLabel?: string;
}) {
  return (
    <div className="section">
      <div className="section-text">
        <h2>{title}</h2>
        <h4>{description}</h4>
        {linkHref && linkLabel && (
          <Link href={linkHref} className="button cta-button section-link">
            {linkLabel}
          </Link>
        )}
      </div>
      <div className="section-images">
        {images.map((image, index) => (
          <div key={index} className={`section-image-${index}`}>
            <PolaroidCard datum={image} openPopup={() => {}} />
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

      {/* // TODO: update these descriptions with actual content specific to AAC. */}
      <div className="sections">
        <Section
          title="Hikes"
          description="From coastal strolls to mountain summits, our hikes are designed for all skill levels. Join us as we explore the breathtaking trails around us and connect with nature and each other."
          images={hikeImages}
        />
        <Section
          title="City Exploration"
          description="We also love exploring the outdoor gems within our city! From hidden parks to vibrant markets, our city events are perfect for those who want to enjoy the outdoors without leaving the urban landscape. Join us for a day of discovery and fun in the city!"
          images={cityImages}
        />
        <Section
          title="Potluck Picnics"
          description="Enjoy a nice day outside at our potluck picnics! Every week, we host a picnic in Aldrich Park, featuring snacks, games, and sports. They're a great way to meet new people and enjoy the outdoors without leaving campus!"
          images={picnicImages}
        />
        <Section
          title="Quarterly Retreats"
          description="Every quarter, the club goes on a weekend retreat, often the highlight of the quarter for many of our members. These trips include 2-3 nights of camping, hiking, and local exploration at some of the best outdoor spots in the United States!"
          images={retreatImages}
          linkHref="/retreats"
          linkLabel="Explore Past Retreats"
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
