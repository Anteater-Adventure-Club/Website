"use client";

import Image from "next/image";
import Link from "next/link";
import "./page.css";

export default function About() {
  return (
    <div className="about">
      {/* Header */}
      <div className="about-header">
        <h1>Our Mission...</h1>
        <p>
          Fostering a sense of community while making nature as accessible as
          possible!
        </p>
      </div>

      <div className="sections">
        {/* Hikes */}
        <div className="section">
          <div className="section-text">
            <h2>Hikes</h2>
            <p>
              Explore weekly hikes across Orange County and Southern California
              — scenic trails, great company, and adventure starting right here
              at UCI
            </p>
          </div>
          <div className="section-images">
            <Image
              src="/images/events/hike_unknown.jpg"
              alt="Unknown Hike"
              width={300}
              height={300}
              className="section-image"
            />
            <Image
              src="/images/events/laguna_hike.jpg"
              alt="Laguna Hike"
              width={300}
              height={300}
              className="section-image"
            />
          </div>
        </div>

        {/* City Exploration */}
        <div className="section reverse">
          <div className="section-images">
            <Image
              src="/images/events/san_diego.JPG"
              alt="San Diego Exploration"
              width={300}
              height={300}
              className="section-image"
            />
            <Image
              src="/images/events/la_city.jpg"
              alt="LA Exploration"
              width={300}
              height={300}
              className="section-image"
            />
          </div>
          <div className="section-text">
            <h2>City Exploration</h2>
            <p>
              Adventure isn&apos;t just limited to nature — join us on a city
              exploration, where we try new food, explore museums, and feel the
              rush of a new city
            </p>
          </div>
        </div>

        {/* Quarterly Retreats */}
        <div className="section">
          <div className="section-text">
            <h2>Quarterly Retreats</h2>
            <p>
              Every quarter, the club goes on a weekend retreat, often the
              highlight of the quarter for many of our members. Past retreat
              locations include national parks like Sequoia and Death Valley,
              lakes like Lake Arrowhead, and more!
            </p>
          </div>
          <div className="section-images">
            <Image
              src="/images/events/death_valley.jpg"
              alt="Death Valley"
              width={300}
              height={300}
              className="section-image"
            />
            <Image
              src="/images/events/sequoia.jpg"
              alt="Sequoia"
              width={300}
              height={300}
              className="section-image"
            />
          </div>
        </div>
      </div>

      {/* Socials */}
      <div className="about-connect">
        <h2>Join the Club!</h2>
        <p>
          Our primary form of communication is our club Discord server, but we
          also promote all of our events on our club Instagram.
        </p>
        <div className="social-buttons">
          <Link
            href="https://discord.gg/YOUR_DISCORD_LINK"
            className="button social-button discord-button"
            target="_blank"
          >
            <Image
              src="/logos/Discord.svg"
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
