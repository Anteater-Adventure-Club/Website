"use client";

import { useState } from "react";
import Image from "next/image";
import "./Polaroid.css";
import Popup from "@/components/Popup/Popup";

type DataType = Officer;

interface PolaroidCardProps {
  datum: DataType;
  openPopup: (datum: DataType) => void;
}

function PolaroidCard({ datum, openPopup }: PolaroidCardProps) {
  return (
    <div className="polaroid-card" onClick={() => openPopup(datum)}>
      <Image
        src={`/images/officers/${datum.id}.jpg`}
        alt={datum.name}
        width={1000}
        height={0}
      />
      <div className="polaroid-caption">
        <h3>{datum.name}</h3>
        <p>{datum.role}</p>
      </div>
    </div>
  );
}

export default function Polaroid({ data }: { data: DataType[] }) {
  const [activePolaroid, setActivePolaroid] = useState<DataType | null>(null);
  const openPopup = (datum: DataType) => setActivePolaroid(datum);
  const closePopup = () => setActivePolaroid(null);

  return (
    <>
      <div className="polaroid-gallery">
        {data.map((datum) => (
          <PolaroidCard key={datum.id} datum={datum} openPopup={openPopup} />
        ))}
      </div>

      {activePolaroid && (
        <Popup
          key={activePolaroid.id}
          officer={activePolaroid}
          closePopup={closePopup}
        />
      )}
    </>
  );
}
