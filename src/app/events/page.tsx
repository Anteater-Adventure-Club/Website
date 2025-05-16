"use client";

import "./page.css";
import { upcomingEvents, pastEvents } from "@/data/events";
import { PolaroidGallery } from "@/components/Polaroid/Polaroid";

export default function Events() {
  return (
    <div>
      <div className="events-header text-center">
        <h1>Check out our events!</h1>
        <h4>Click on each event to learn more...</h4>
      </div>
      <h3 className="text-center">Upcoming Events</h3>
      <PolaroidGallery data={upcomingEvents} dataType="event" />
      <h3 className="text-center">Past Events</h3>
      <PolaroidGallery data={pastEvents} dataType="event" />
    </div>
  );
}
