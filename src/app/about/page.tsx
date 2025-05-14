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
              — scenic trails, great company, and adventure starting right from
              UCI.
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
        <div className="section">
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
          <div className="section-text right-align">
            <h2>City Exploration</h2>
            <p>
              Adventure isn&apos;t just limited to nature. Join us on a city
              exploration day, try new food, explore museums, feel the rush of
              the city.
            </p>
          </div>
        </div>

        {/* Quarterly Retreats */}
        <div className="section">
          <div className="section-text">
            <h2>Quarterly Retreats</h2>
            <p>
              Every quarter the club goes on a weekend long retreat which is
              always the highlight of the quarter for many of our members. Past
              retreat locations include:
            </p>
            <br />
            <p>- Josuha Tree National Park</p>
            <p>- Red Rock Canyon State Park & Las Vegas</p>
            <p>- Lake Arrowhead</p>
            <p>- Sequoia National Park</p>
            <p>- Death Valley National Park & Las Vegas</p>
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
