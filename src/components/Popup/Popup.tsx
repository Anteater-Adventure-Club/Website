import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import "./Popup.css";

function PopupItem({ name, content }: { name: string; content: string }) {
  return (
    <div>
      <h3>{name}</h3>
      <p>{content}</p>
    </div>
  );
}

function EventPopup({
  event,
  closePopup,
}: {
  event: AACEvent;
  closePopup: () => void;
}) {
  return (
    <>
      <div className="popup-header">
        <h3>{event.name}</h3>
        <div className="popup-buttons">
          <X className="popup-close-icon" onClick={() => closePopup()} />
        </div>
      </div>
      <div className="popup-body">
        <PopupItem name="Date" content={event.date} />
        <PopupItem name="Event Info" content={event.description} />
        {/* For future events show sign-up link */}
        {event.signUpLink && (
          <Link
            href={event.signUpLink}
            target="_blank"
            rel="noopener noreferrer"
            className="signup-link"
          >
            <h3 className="signup-link-text">Click here to sign up!</h3>
          </Link>
        )}
      </div>
    </>
  );
}

function OfficerPopup({
  officer,
  closePopup,
}: {
  officer: Officer;
  closePopup: () => void;
}) {
  return (
    <>
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
      <div className="popup-body">
        <PopupItem name="Role" content={officer.role} />
        <PopupItem name="Major" content={officer.major} />
        <PopupItem name="Why I joined AAC" content={officer.whyJoined} />
        <PopupItem
          name="My favorite AAC Memory..."
          content={officer.favoriteMemory}
        />
      </div>
    </>
  );
}

export default function Popup({
  datum,
  dataType,
  closePopup,
}: {
  datum: PolaroidType;
  dataType: PolaroidTypeName;
  closePopup: () => void;
}) {
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

  return (
    <div className="popup">
      <div className={`popup-content popup-background-${datum.id}`} ref={ref}>
        {dataType === "event" ? (
          <EventPopup event={datum as AACEvent} closePopup={closePopup} />
        ) : (
          <OfficerPopup officer={datum as Officer} closePopup={closePopup} />
        )}
      </div>
    </div>
  );
}
