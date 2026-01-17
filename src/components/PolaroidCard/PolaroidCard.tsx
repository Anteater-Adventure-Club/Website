"use client";

import Image from "next/image";
import "./PolaroidCard.css";

interface PolaroidCardProps {
  datum: PolaroidType;
  openPopup: (datum: PolaroidType) => void;
}

export function PolaroidCard({
  datum,
  openPopup,
}: PolaroidCardProps) {
  return (
    <div className="polaroid-card" onClick={() => openPopup(datum)}>
      <Image
        src={datum.imagePath}
        alt={datum.name}
        width={1000}
        height={0}
      />
      <div className="polaroid-caption">
        <h3>{datum.name}</h3>
        <p>{(datum as Officer).role ?? (datum as AACEvent).date}</p>
      </div>
    </div>
  );
}
