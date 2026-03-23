"use client";

import { useEffect, useState } from "react";
import { PolaroidGallery } from "@/components/PolaroidGallery/PolaroidGallery";
import UpcomingCalendar from "@/components/UpcomingCalendar/UpcomingCalendar";
import "./Events.css";

async function fetchEvents(status: "past"): Promise<AACEvent[]> {
  const response = await fetch(`/api/events?status=${status}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${status} events`);
  }

  const payload = (await response.json()) as { data: AACEvent[] };
  return payload.data;
}

export default function Events() {
  const [pastEvents, setPastEvents] = useState<AACEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const past = await fetchEvents("past");

        if (!mounted) {
          return;
        }

        setPastEvents(past);
      } catch {
        if (!mounted) {
          return;
        }

        setError("Could not load events right now.");
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="events-page">
      <div className="events-header">
        <h1>Stay up to date!</h1>
        <h4>Click on any date or past event to learn more!</h4>
      </div>

      {isLoading && <p>Loading events...</p>}
      {error && <p>{error}</p>}

      {!isLoading && !error && (
        <>
          <h2 className="section-title">Upcoming Events</h2>

          <div className="calendar-wrapper">
            <UpcomingCalendar />
          </div>

          <h2 className="section-title">Past Events</h2>

          <PolaroidGallery data={pastEvents} dataType="event" />
        </>
      )}
    </div>
  );
}
