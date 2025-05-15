"use client";

import "./page.css";
import events from "@/data/events";
import { PolaroidGallery } from "@/components/Polaroid/Polaroid";

export default function EventGallery() {
  return (
    <div>
      <h1>Check out our previous events!</h1>
      <PolaroidGallery data={events} dataType="event" />
    </div>
  );
}
