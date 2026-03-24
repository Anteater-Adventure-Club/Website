"use client";
import "./Footer.css";

export default function Header() {
  return (
    <footer>
      <p>
        &copy; {new Date().getFullYear()} Anteater Adventure Club{" "}
        <span className="extra-footer-text">| Making Nature Accessible!</span>{" "}
        🌲
      </p>
    </footer>
  );
}
