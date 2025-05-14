"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import boardMembers from "@/data/boardMembers";
import "./page.css";

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

const PolaroidCard = ({
  member,
  openPopup,
}: {
  member: BoardMember;
  openPopup: (id: string) => void;
}) => {
  return (
    <div
      className="polaroid"
      onClick={() => openPopup(member.id)}
      data-popup-style={`${member.id}-style`}
    >
      <Image
        src={`/images/board/${member.id}.jpg`}
        alt={member.name}
        width={1000}
        height={0}
      />
      <div className="polaroid-caption">
        <h3>{member.name}</h3>
        <p>{member.role}</p>
      </div>
    </div>
  );
};

const PopupDetails = ({
  member,
  closePopup,
}: {
  member: BoardMember;
  closePopup: (id: string) => void;
}) => {
  return (
    <div id={`popup-${member.id}`} className="popup">
      <div
        className={`popup-content ${member.id}-style`}
        style={{ backgroundColor: colors[member.id].backgroundColor }}
      >
        <span className="close" onClick={() => closePopup(member.id)}>
          &times;
        </span>
        <h3 style={{ color: colors[member.id].color }}>{member.name}</h3>
        <br />
        <p>{member.role}</p>
        <h3>Major</h3>
        <p>{member.major}</p>
        <h3>Why I {member.id === "aristani" ? "created" : "joined"} AAC</h3>
        <p>{member.whyJoined}</p>
        <h3>My favorite AAC Memory...</h3>
        <p>{member.favoriteMemory}</p>
        <div className="instagram-link">
          <Link href={member.instagram} target="_blank" rel="noopener">
            <Image
              src="/logos/instagram.svg"
              alt="Instagram Logo"
              width={55}
              height={40}
              className="instagram-icon"
            />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default function Board() {
  const [activePopup, setActivePopup] = useState<string | null>(null);

  const openPopup = (id: string) => {
    setActivePopup(id);
    // Add any additional styling needed for the popup to appear
    document.getElementById(`popup-${id}`)?.classList.add("active");
  };

  const closePopup = (id: string) => {
    setActivePopup(null);
    // Remove the active class when closing
    document.getElementById(`popup-${id}`)?.classList.remove("active");
  };

  return (
    <div>
      <div className="board-header">
        <h1>Meet the Board!</h1>
        <h4>Click to learn more about each officer!</h4>
      </div>

      <div className="polaroid-gallery">
        {boardMembers.map((member) => (
          <PolaroidCard key={member.id} member={member} openPopup={openPopup} />
        ))}
      </div>

      {boardMembers.map((member) => (
        <PopupDetails key={member.id} member={member} closePopup={closePopup} />
      ))}

      {activePopup && (
        <div
          className="popup-overlay"
          onClick={() => closePopup(activePopup)}
        ></div>
      )}
    </div>
  );
}
