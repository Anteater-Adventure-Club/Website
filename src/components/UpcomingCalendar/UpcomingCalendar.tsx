"use client";

import { useState } from "react";
import "./UpcomingCalendar.css";

type UpcomingCalendarProps = {
  events: AACEvent[];
};

export default function UpcomingCalendar({ events }: UpcomingCalendarProps) {
  const [selectedEvent, setSelectedEvent] = useState<AACEvent | null>(null);

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const monthName = today.toLocaleString("default", { month: "long" });

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const handleClick = (day: number) => {
    const event = events.find((e) => {
      const eventDate = new Date(e.date);
      return (
        eventDate.getDate() === day &&
        eventDate.getMonth() === currentMonth &&
        eventDate.getFullYear() === currentYear
      );
    });

    setSelectedEvent(event || null);
  };

  return (
    <div className="calendar-container">
        
    <div className="calendar-header">
        {monthName} {currentYear}
    </div>

      {/* Days of Week */}
      <div className="calendar-weekdays">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="weekday">
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="calendar-grid">
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;

          const isToday =
            day === today.getDate() &&
            currentMonth === today.getMonth() &&
            currentYear === today.getFullYear();

          const hasEvent = events.some((e) => {
            const eventDate = new Date(e.date);
            return (
              eventDate.getDate() === day &&
              eventDate.getMonth() === currentMonth &&
              eventDate.getFullYear() === currentYear
            );
          });

          return (
            <div
              key={day}
              onClick={() => handleClick(day)}
              className={`calendar-day ${hasEvent ? "has-event" : ""} ${isToday ? "today" : ""}`}
            >
              <span>{day}</span>
            </div>
          );
        })}
      </div>

      {/* Selected Event Panel */}
      {selectedEvent && (
        <div className="event-details">
          <h3 className="event-title">{selectedEvent.name}</h3>

          <p className="event-date">{selectedEvent.date}</p>

          <p className="event-description">
            {selectedEvent.description}
          </p>

          {selectedEvent.signUpLink && (
            <a
              href={selectedEvent.signUpLink}
              target="_blank"
              className="event-link"
            >
              Sign Up
            </a>
          )}
        </div>
      )}
    </div>
  );
}
