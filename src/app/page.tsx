"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PolaroidCard } from "@/components/PolaroidCard/PolaroidCard";
import "./page.css";

function pickThreeRandom(events: AACEvent[]) {
  const shuffled = [...events].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

export default function Home() {
  const [cards, setCards] = useState<AACEvent[]>([]);
  const noop = () => {};

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/events?status=past");
      const json = (await res.json()) as { data: AACEvent[] };
      setCards(pickThreeRandom(json.data));
    }
    load();
  }, []);

  return (
    <div className="home">
      <section className="home-left">
        <h1 className="home-title">
          <span className="word-anteater">Anteater</span>{" "}
          <span className="word-adventure">Adventure</span>{" "}
          <span className="word-club">Club</span>
        </h1>
        <Link href="/about" className="button cta-button">Join the Adventure!</Link>
      </section>

      <section className="home-right">
        {cards[0] && <div className="home-polaroid card-1"><PolaroidCard datum={cards[0]} openPopup={noop} /></div>}
        {cards[1] && <div className="home-polaroid card-2"><PolaroidCard datum={cards[1]} openPopup={noop} /></div>}
        {cards[2] && <div className="home-polaroid card-3"><PolaroidCard datum={cards[2]} openPopup={noop} /></div>}
      </section>
    </div>
  );
}