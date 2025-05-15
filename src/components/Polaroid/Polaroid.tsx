"use client";

import { useState } from "react";
import Image from "next/image";
import "./Polaroid.css";
import Popup from "@/components/Popup/Popup";

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

interface PolaroidGalleryProps {
  data: PolaroidType[];
  dataType: PolaroidTypeName;
}

export function PolaroidGallery({ data, dataType }: PolaroidGalleryProps) {
  const [activePolaroid, setActivePolaroid] = useState<PolaroidType | null>(null);
  const openPopup = (datum: PolaroidType) => setActivePolaroid(datum);
  const closePopup = () => setActivePolaroid(null);

  return (
    <>
      <div className="polaroid-gallery">
        {data.map((datum) => (
          <PolaroidCard
            key={datum.id}
            datum={datum}
            openPopup={openPopup}
          />
        ))}
      </div>

      {activePolaroid && (
        <Popup
          key={activePolaroid.id}
          datum={activePolaroid}
          dataType={dataType}
          closePopup={closePopup}
        />
      )}
    </>
  );
}
