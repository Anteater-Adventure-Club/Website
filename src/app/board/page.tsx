"use client";

import { PolaroidGallery } from "@/components/Polaroid/Polaroid";
import officers from "@/data/officers";

export default function Board() {
  return (
    <div>
      <div className="text-center">
        <h1>Meet the Board!</h1>
        <h4>Click to learn more about each officer!</h4>
      </div>
      <PolaroidGallery data={officers} dataType="officer" />
    </div>
  );
}
