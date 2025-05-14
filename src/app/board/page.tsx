"use client";

import Image from "next/image";
import { useState } from "react";
import boardMembers from "@/data/boardMembers";
import "./page.css";

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
        width={300}
        height={300}
      />
      <div className="caption">
        <span className="name-font">{member.name}</span>
        <br />
        <span className="role-font">{member.role}</span>
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
      <div className={`popup-content ${member.id}-style`}>
        <span className="close" onClick={() => closePopup(member.id)}>
          &times;
        </span>
        <span className={`name-font ${member.id}-name`}>{member.name}</span>
        <br />
        <span className="role-font">{member.role}</span>
        <h3>Major</h3>
        <p>{member.major}</p>
        <h3>Why I {member.id === "aristani" ? "created" : "joined"} AAC</h3>
        <p>{member.whyJoined}</p>
        <h3>My favorite AAC Memory...</h3>
        <p>{member.favoriteMemory}</p>
        <div className="instagram-link">
          <a href={member.instagram} target="_blank" rel="noopener">
            <Image
              src="/logos/instagram.svg"
              alt="Instagram"
              width={55}
              height={40}
              className="instagram-icon"
            />
          </a>
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
    <main className="meet_the_board-main">
      <h1>Meet the Board!</h1>
      <h6>Click to learn more about each officer!</h6>

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
    </main>
  );
}
