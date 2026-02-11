"use client";

import { PolaroidGallery } from "@/components/PolaroidGallery/PolaroidGallery";
import { upcomingEvents } from "@/data/upcomingEvents";
import { pastEvents } from "@/data/pastEvents";
import UpcomingCalendar from "@/components/UpcomingCalendar/UpcomingCalendar";
import "./Events.css";

export default function Events() {
  return (
    <div className="events-page">
      <div className="events-header">
        <h1>Stay up to date!</h1>
        <h4>Click on any date or past event to learn more</h4>
      </div>

      <h2 className="section-title">Upcoming Events</h2>

      <div className="calendar-wrapper">
        <UpcomingCalendar events={upcomingEvents} />
      </div>

      <h2 className="section-title">Past Events</h2>

      <PolaroidGallery data={pastEvents} dataType="event" />
    </div>
  );
}

