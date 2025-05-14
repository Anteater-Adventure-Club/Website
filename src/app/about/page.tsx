"use client";

import Image from "next/image";
import Link from "next/link";

export default function About() {
  return (
    <>
      <main className="about-main">
        <h1>Our Mission...</h1>
        <p>
          Fostering a sense of community while making nature as accessible as
          possible!
        </p>
        <p>Check out some of the photos taken by our members:</p>

        <div className="section-wrapper">
          <div className="section-content">
            <h2>Hikes</h2>
            <p>
              Explore weekly hikes across Orange County and Southern
              California—scenic trails, great company, and adventure starting
              right from UCI.
            </p>
          </div>
          <div className="polariod-hike"></div>
          <Image
            src="/images/hike_unknown.jpg"
            alt="Unknown Hike"
            width={300}
            height={300}
            className="section-image"
          />
          <Image
            src="/images/laguna_hike.jpg"
            alt="Laguna Hike"
            width={300}
            height={300}
            className="section-image"
          />
        </div>

        <div className="section-wrapper left_side">
          <Image
            src="/images/san_diego.JPG"
            alt="San Diego Exploration"
            width={300}
            height={300}
            className="section-image"
          />
          <Image
            src="/images/la_city.jpg"
            alt="LA Exploration"
            width={300}
            height={300}
            className="section-image"
          />

          <div className="section-content right-align">
            <h2>City Exploration</h2>
            <p>
              Adventure isn&apos;t just limited to nature. Join us on a city
              exploration day, try new food, explore museums, feel the rush of
              the city.
            </p>
          </div>
        </div>

        <div className="section-wrapper">
          <div className="section-content">
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
          <Image
            src="/images/death_valley.jpg"
            alt="Death Valley"
            width={300}
            height={300}
            className="section-image"
          />
          <Image
            src="/images/sequoia.jpg"
            alt="Sequoia"
            width={300}
            height={300}
            className="section-image"
          />
        </div>
      </main>

      <div className="about-connect">
        <h2>Join the Club!</h2>
        <p>
          Our primary form of communication is on our club Discord server, and
          we also promote all our events on the AAC official Instagram page.
        </p>
      </div>

      <div className="social-buttons">
        <Link
          href="https://discord.gg/YOUR_DISCORD_LINK"
          className="social-button discord-button"
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
          className="social-button instagram-button"
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
    </>
  );
}
