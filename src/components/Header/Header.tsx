"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import "./Header.css";
import { Menu, X } from "lucide-react";

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  const closeMenu = () => setIsMenuOpen(false);

  const isActive = (path: string) => {
    if (path === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(path);
  };

  return (
    <header>
      <div className="header-container">
        {/* Hamburger button */}
        <button
          className="hamburger-button"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
          aria-expanded={isMenuOpen}
        >
          {isMenuOpen ? <X /> : <Menu />}
        </button>

        {/* Desktop Navigation */}
        <nav className="desktop-nav">
          <Link href="/" className={isActive("/") ? "active" : ""}>
            Home
          </Link>
          <Link href="/about" className={isActive("/about") ? "active" : ""}>
            About
          </Link>
          <Link href="/events" className={isActive("/events") ? "active" : ""}>
            Events
          </Link>
          <Link href="/board" className={isActive("/board") ? "active" : ""}>
            Board
          </Link>
          <Link
            href="/membership"
            className={isActive("/membership") ? "active" : ""}
          >
            Membership
          </Link>
        </nav>
      </div>

      {/* Mobile Menu Overlay */}
      <div
        className={`mobile-menu-overlay ${isMenuOpen ? "open" : ""}`}
        onClick={closeMenu}
      >
        <nav className="mobile-nav" onClick={(e) => e.stopPropagation()}>
          <Link
            href="/"
            onClick={closeMenu}
            className={isActive("/") ? "active" : ""}
          >
            Home
          </Link>
          <Link
            href="/about"
            onClick={closeMenu}
            className={isActive("/about") ? "active" : ""}
          >
            About
          </Link>
          <Link
            href="/events"
            onClick={closeMenu}
            className={isActive("/events") ? "active" : ""}
          >
            Events
          </Link>
          <Link
            href="/board"
            onClick={closeMenu}
            className={isActive("/board") ? "active" : ""}
          >
            Board
          </Link>
          <Link
            href="/membership"
            onClick={closeMenu}
            className={isActive("/membership") ? "active" : ""}
          >
            Membership
          </Link>
        </nav>
      </div>
    </header>
  );
}
