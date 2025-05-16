"use client";

import "./page.css";

export default function Membership() {
  return (
    <div>
      <h1>What is AAC Membership?</h1>
      <div className="membership-boxes">
        <div className="membership-box bg-[#d6fcff]">
          <h3>1. Access to quarterly retreat</h3>
        </div>
        <div className="membership-box bg-[#d6e4ff]">
          <h3>2. Priority car ride assignnment</h3>
        </div>
        <div className="membership-box bg-[#dcffd6]">
          <h3>3. Helps us create more amazing events</h3>
        </div>
      </div>
    </div>
  );
}
