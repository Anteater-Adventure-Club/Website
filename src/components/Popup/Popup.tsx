import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import "./Popup.css";

interface PopupProps {
  datum: PolaroidType;
  dataType: PolaroidTypeName;
  closePopup: () => void;
}

export default function Popup({ datum, dataType, closePopup }: PopupProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        closePopup();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [closePopup]);

  if (dataType === "event") {
    const event = datum as AACEvent;
    return (
      <div className="popup">
        <div className="popup-content" ref={ref}>
          <div className="popup-header">
            <h3>{event.name}</h3>
            <div className="popup-buttons">
              <X className="popup-close-icon" onClick={() => closePopup()} />
            </div>
          </div>
          <div className="popup-body">
            <div>
              <h3>Date</h3>
              <p>{event.date}</p>
            </div>
            <div>
              <h3>Event Info</h3>
              <p>{event.description}</p>
            </div>
            {/* For future events show sign-up link */}
            {event.signUpLink && (
              <Link
                href={event.signUpLink}
                target="_blank"
                rel="noopener noreferrer"
                className="signup-link"
              >
                <h3 className="signup-link-text">
                  Click here to sign up!
                </h3>
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  const officer = datum as Officer;

  return (
    <div className="popup">
      <div className={`popup-content popup-background-${officer.id}`} ref={ref}>
        <div className="popup-header">
          <h3 className={`popup-title-${officer.id}`}>{officer.name}</h3>
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
