"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PolaroidCard } from "@/components/PolaroidCard/PolaroidCard";
import "./page.css";

function shuffleEvents(events: AACEvent[]) {
  const shuffled = [...events].sort(() => Math.random() - 0.5);
  return shuffled;
}

function getVisiblePair(events: AACEvent[], start: number): AACEvent[] {
  if (events.length === 0) {
    return [];
  }

  if (events.length === 1) {
    return [events[0]];
  }

  return [events[start % events.length], events[(start + 1) % events.length]];
}

export default function Home() {
  const [cards, setCards] = useState<AACEvent[]>([]);
  const [pairStart, setPairStart] = useState(0);
  const [isSwapping, setIsSwapping] = useState(false);
  const noop = () => {};

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/events?status=past");
      const json = (await res.json()) as { data: AACEvent[] };
      setCards(shuffleEvents(json.data));
    }
    load();
  }, []);

  useEffect(() => {
    if (cards.length <= 2) {
      return;
    }

    const interval = setInterval(() => {
      setIsSwapping(true);
      setTimeout(() => {
        setPairStart((prev) => (prev + 2) % cards.length);
        setIsSwapping(false);
      }, 400);
    }, 9000); // Currently set to ~9 seconds

    return () => clearInterval(interval);
  }, [cards]);

  const visibleCards = getVisiblePair(cards, pairStart);

  return (
    <div className="home">
      <section className="home-left">
        <h1 className="home-title">
          <span className="word-anteater">Anteater</span>{" "}
          <span className="word-adventure">Adventure</span>{" "}
          <span className="word-club">Club</span>
        </h1>
        <Link href="/events" className="button cta-button">Join the Adventure!</Link>
      </section>

      <section className="home-right">
        <div className={`polaroid-row ${isSwapping ? "swapping" : ""}`}>
          {visibleCards.map((card) => (
            <div key={card.id} className="home-polaroid">
              <PolaroidCard datum={card} openPopup={noop} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
