"use client";

import Link from "next/link";

export default function Header() {
  return (
    <header>
      <nav className="flex gap-8">
        <Link href="/">Home</Link>
        <Link href="/about">About</Link>
        <Link href="/events">Events</Link>
        <Link href="/board">Board</Link>
        <Link href="/membership">Membership</Link>
      </nav>
    </header>
  );
}
