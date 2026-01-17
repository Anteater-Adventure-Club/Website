"use client";

import { useState } from "react";
import { PolaroidCard } from "@/components/PolaroidCard/PolaroidCard";
import Popup from "@/components/Popup/Popup";
import "./PolaroidGallery.css";

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
