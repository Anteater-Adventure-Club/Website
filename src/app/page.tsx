"use client";

import Link from "next/link";
import Image from "next/image";
import "./page.css";

export default function Home() {
  return (
    <div className="home">
      <h1>Anteater Adventure Club</h1>
      <Link href="/about" className="button cta-button">
        Join the Adventure!
      </Link>

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
