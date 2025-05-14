"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import "./page.css";
import officers from "@/data/officers";

interface Colors {
  [key: string]: {
    backgroundColor: string;
    color: string;
  };
}

const colors: Colors = {
  aristani: {
    backgroundColor: "#ffebeb",
    color: "#ffadad",
  },
  alexis: {
    backgroundColor: "#ffedd6",
    color: "#ffca85",
  },
  lokesh: {
    backgroundColor: "#ebf2ff",
    color: "#85afff",
  },
  thomas: {
    backgroundColor: "#fdffd6",
    color: "#d5e000",
  },
  sofia: {
    backgroundColor: "#eeffeb",
    color: "#97ff85",
  },
  daron: {
    backgroundColor: "#dcd6ff",
    color: "#9785ff",
  },
  charlie: {
    backgroundColor: "#d6fcff",
    color: "#00d1e0",
  },
  ryan: {
    backgroundColor: "#ffebff",
    color: "#ffadff",
  },
  jason: {
    backgroundColor: "#ffedd6",
    color: "#ffca85",
  },
  kristina: {
    backgroundColor: "#ffebeb",
    color: "#ffadad",
  },
};

function PolaroidCard({
  officer,
  openPopup,
}: {
  officer: Officer;
  openPopup: (officer: Officer) => void;
}) {
  return (
    <div className="polaroid" onClick={() => openPopup(officer)}>
      <Image
        src={`/images/officers/${officer.id}.jpg`}
        alt={officer.name}
        width={1000}
        height={0}
      />
      <div className="polaroid-caption">
        <h3>{officer.name}</h3>
        <p>{officer.role}</p>
      </div>
    </div>
  );
}

function Popup({
  officer,
  closePopup,
  ref,
}: {
  officer: Officer;
  closePopup: () => void;
  ref: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="popup">
      <div
        className="popup-content"
        style={{ backgroundColor: colors[officer.id].backgroundColor }}
        ref={ref}
      >
        <div className="popup-header">
          <h3 style={{ color: colors[officer.id].color }}>{officer.name}</h3>
          <div className="popup-buttons">
            <Link href={officer.instagram} target="_blank" rel="noopener">
              <Image
                src="/logos/instagram.svg"
                alt="Instagram Logo"
                width={20}
                height={0}
                className="popup-instagram-icon"
              />
            </Link>
            <X className="popup-close-icon" onClick={() => closePopup()} />
          </div>
        </div>
        <div>
          <h3 className="popup-prompt">Role</h3>
          <p>{officer.role}</p>
          <h3 className="popup-prompt">Major</h3>
          <p>{officer.major}</p>
          <h3 className="popup-prompt">
            Why I {officer.id === "aristani" ? "created" : "joined"} AAC
          </h3>
          <p>{officer.whyJoined}</p>
          <h3 className="popup-prompt">My favorite AAC Memory...</h3>
          <p>{officer.favoriteMemory}</p>
        </div>
      </div>
    </div>
  );
}

export default function Board() {
  const [activeOfficer, setActiveOfficer] = useState<Officer | null>(null);

  const openPopup = (officer: Officer) => setActiveOfficer(officer);
  const closePopup = () => setActiveOfficer(null);

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        closePopup();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div>
      <div className="board-header">
        <h1>Meet the Board!</h1>
        <h4>Click to learn more about each officer!</h4>
      </div>

      <div className="polaroid-gallery">
        {officers.map((officer) => (
          <PolaroidCard
            key={officer.id}
            officer={officer}
            openPopup={openPopup}
          />
        ))}
      </div>

      {activeOfficer && (
        <Popup
          key={activeOfficer.id}
          officer={activeOfficer}
          closePopup={closePopup}
          ref={ref}
        />
      )}
    </div>
  );
}
