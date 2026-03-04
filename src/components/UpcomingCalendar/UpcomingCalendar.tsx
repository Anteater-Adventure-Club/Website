"use client";

import { useEffect, useState } from "react";
import "./UpcomingCalendar.css";

function monthParamFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function UpcomingCalendar() {
  const [displayDate, setDisplayDate] = useState(() => new Date());
  const [events, setEvents] = useState<AACEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<AACEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const today = new Date();
  const currentYear = displayDate.getFullYear();
  const currentMonth = displayDate.getMonth();
  const monthName = displayDate.toLocaleString("default", { month: "long" });

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  useEffect(() => {
    let mounted = true;

    async function loadMonthEvents() {
      setIsLoading(true);
      setError(null);
      setSelectedEvent(null);

      try {
        const month = monthParamFromDate(displayDate);
        const response = await fetch(`/api/events?month=${month}`);
        if (!response.ok) {
          throw new Error("Failed request");
        }

        const payload = (await response.json()) as { data: AACEvent[] };
        if (!mounted) {
          return;
        }

        setEvents(payload.data);
      } catch {
        if (!mounted) {
          return;
        }
        setEvents([]);
        setError("Could not load this month's events.");
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadMonthEvents();

    return () => {
      mounted = false;
    };
  }, [displayDate]);

  const previousMonth = () => {
    setDisplayDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setDisplayDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

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
        <button type="button" className="month-nav-button" onClick={previousMonth}>
          Prev
        </button>
        <span>
          {monthName} {currentYear}
        </span>
        <button type="button" className="month-nav-button" onClick={nextMonth}>
          Next
        </button>
      </div>

      <div className="calendar-legend" aria-label="Event type legend">
        <div className="legend-item">
          <span className="legend-color event-regular" aria-hidden="true" />
          <span>Event</span>
        </div>
        <div className="legend-item">
          <span className="legend-color event-weekly-meeting" aria-hidden="true" />
          <span>Weekly Meeting</span>
        </div>
        <div className="legend-item">
          <span className="legend-color event-potlock-picnic" aria-hidden="true" />
          <span>Potluck Picnic</span>
        </div>
      </div>

      {isLoading && <p className="calendar-status">Loading month...</p>}
      {error && <p className="calendar-status">{error}</p>}

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

            const eventForDay = events.find((e) => {
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
              className={`calendar-day ${eventForDay ? `event-${eventForDay.type?.replace(/\s+/g, "-")}` : ""} ${isToday ? "today" : ""}`}
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
