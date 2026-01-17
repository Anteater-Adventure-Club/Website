"use client";

import { useState } from "react";
import "./PreviousBoards.css";
import previousBoards from "@/data/previousOfficers";

function PreviousBoard({
  officers,
  year,
  openYear,
  setOpenYear
}: {
  officers: PreviousOfficer[];
  year: string;
  openYear: string;
  setOpenYear: (year: string) => void;
}) {

  return (
    <div className="previous-board-container">
      <button
        className="previous-board-toggle"
        onClick={() => setOpenYear(openYear === year ? "" : year)}
        aria-expanded={openYear === year}
      >
        <h3>{year} Board</h3>
        <h3 className="toggle-icon">{openYear === year ? "-" : "+"}</h3>
      </button>

      {openYear === year && (
        <div className="previous-board-content">
          <div className="previous-board-grid">
            {officers.map((officer) => (
              <div key={officer.id} className="previous-board-item">
                <span className="previous-board-name">{officer.name}</span>
                <span className="previous-board-role">{officer.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PreviousBoards() {
  const [openYear, setOpenYear] = useState("");

  return previousBoards.map((board) => (
    <PreviousBoard
      key={board.year}
      officers={board.officers}
      year={board.year}
      openYear={openYear}
      setOpenYear={setOpenYear}
    />
  ));
}
