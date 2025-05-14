"use client";

import { useState } from "react";
import Image from "next/image";
import events from "@/data/events";
import "@/components/Polaroid/Polaroid.css";

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
    <div>
      <h1>Check out our previous events!</h1>

      <div className="polaroid-gallery">
        {events.map((event) => (
          <div key={event.id}>
            <div
              className="polaroid"
              onClick={() => handleOpenPopup(event.id, event.popupStyle)}
            >
              <Image
                src={`/images/events/${event.imageName}`}
                alt={event.name}
                width={1000}
                height={0}
              />
              <div className="polaroid-caption">
                <h3>{event.name}</h3>
                <p>{event.date}</p>
              </div>
            </div>

            {/* {openPopup && openPopup.id === event.id && (
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
                  <h3>{event.name}</h3>
                  <br />
                  <p>{event.date}</p>
                  <h3>Event Info</h3>
                  <p>{event.description}</p>
                </div>
              </div>
            )} */}
          </div>
        ))}
      </div>
    </div>
  );
}
