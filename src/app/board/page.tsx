"use client";

import "./page.css";
import officers from "@/data/officers";
import Polaroid from "@/components/Polaroid/Polaroid";

export default function Board() {
  return (
    <div>
      <div className="board-header">
        <h1>Meet the Board!</h1>
        <h4>Click to learn more about each officer!</h4>
      </div>
      <Polaroid data={officers} />
    </div>
  );
}
