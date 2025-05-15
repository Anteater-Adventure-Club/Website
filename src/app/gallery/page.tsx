"use client";

import "./page.css";
import events from "@/data/events";
import { PolaroidGallery } from "@/components/Polaroid/Polaroid";

export default function EventGallery() {
  return (
    <div>
      <h1>Check out our events!</h1>
      <h4 style={{ textAlign: "center" }}>
        Click on each event to learn more...
      </h4>
      <PolaroidGallery data={events} dataType="event" />
    </div>
  );
}
