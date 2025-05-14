"use client";

import Link from "next/link";
import "./Header.css";

export default function Header() {
  return (
    <header>
      <nav>
        <Link href="/">Home</Link>
        <Link href="/about">About</Link>
        <Link href="/board">Board</Link>
        <Link href="/gallery">Gallery</Link>
        <Link href="/membership">Membership</Link>
      </nav>
    </header>
  );
}
