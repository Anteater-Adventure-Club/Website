"use client";

import { useState } from "react";
import Image from "next/image";
import events from "@/data/events";
import "./page.css";

export default function EventGallery() {
  const [openPopup, setOpenPopup] = useState<PopupState | null>(null);

  const handleOpenPopup = (eventId: string, styleClass: string) => {
    setOpenPopup({
      id: eventId,
      styleClass,
    });
  };

  const handleClosePopup = () => {
    setOpenPopup(null);
  };

  return (
    <div className="event-gallery-main">
      <h1>Check Out our Previous Events!</h1>

      <div className="polaroid-gallery-events">
        {events.map((event) => (
          <div key={event.id}>
            <div
              className="polaroid-events"
              onClick={() => handleOpenPopup(event.id, event.popupStyle)}
            >
              <Image
                src={`/images/events/${event.imageName}`}
                alt={event.name}
                width={300}
                height={200}
              />
              <div className="caption">
                <span className="name-font">{event.name}</span>
                <br />
                <span className="role-font">{event.date}</span>
              </div>
            </div>

            {openPopup && openPopup.id === event.id && (
              <div
                className={`popup ${openPopup.styleClass || ""}`}
                onClick={(e) => {
                  if (e.target === e.currentTarget) handleClosePopup();
                }}
              >
                <div className={`popup-content ${openPopup.styleClass || ""}`}>
                  <span className="close" onClick={handleClosePopup}>
                    &times;
                  </span>
                  <span className="name-font event-name">{event.name}</span>
                  <br />
                  <span className="role-font">{event.date}</span>
                  <h3>Event Info</h3>
                  <p>{event.description}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
