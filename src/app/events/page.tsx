"use client";

import { PolaroidGallery } from "@/components/Polaroid/Polaroid";
import { upcomingEvents, pastEvents } from "@/data/events";

export default function Events() {
  return (
    <div>
      <div className="mb-8 text-center">
        <h1>Check out our events!</h1>
        <h4>Click on each event to learn more...</h4>
      </div>
      <h2 className="text-center">Upcoming Events</h2>
      <PolaroidGallery data={upcomingEvents} dataType="event" />
      <h2 className="text-center">Past Events</h2>
      <PolaroidGallery data={pastEvents} dataType="event" />
    </div>
  );
}
