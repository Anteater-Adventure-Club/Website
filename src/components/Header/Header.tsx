"use client";

import Link from "next/link";
import { useState } from "react";
import "./Header.css";
import { Menu, X } from "lucide-react";

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header>
      <div className="header-container">
        {/* Hamburger button - visible on mobile */}
        <button
          className="hamburger-button"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
          aria-expanded={isMenuOpen}
        >
          {isMenuOpen ? <X /> : <Menu />}
        </button>

        {/* Desktop navigation - visible on screens >= 640px */}
        <nav className="desktop-nav">
          <Link href="/">Home</Link>
          <Link href="/about">About</Link>
          <Link href="/events">Events</Link>
          <Link href="/board">Board</Link>
          <Link href="/membership">Membership</Link>
        </nav>
      </div>

      {/* Mobile menu overlay */}
      <div
        className={`mobile-menu-overlay ${isMenuOpen ? "open" : ""}`}
        onClick={closeMenu}
      >
        <nav className="mobile-nav" onClick={(e) => e.stopPropagation()}>
          <Link href="/" onClick={closeMenu}>
            Home
          </Link>
          <Link href="/about" onClick={closeMenu}>
            About
          </Link>
          <Link href="/events" onClick={closeMenu}>
            Events
          </Link>
          <Link href="/board" onClick={closeMenu}>
            Board
          </Link>
          <Link href="/membership" onClick={closeMenu}>
            Membership
          </Link>
        </nav>
      </div>
    </header>
  );
}
