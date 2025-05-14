"use client";

import Link from "next/link";
import "./page.css";

export default function Home() {
  return (
    <div className="home">
      <h1>Anteater Adventure Club</h1>
      <Link href="/about" className="button cta-button">
        Join the Adventure!
      </Link>
    </div>
  );
}
