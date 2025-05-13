import Link from "next/link";

export default function Home() {
  return (
    <div className="centered-content">
      <div className="center-inner">
        <h1>Anteater Adventure Club</h1>
        <Link href="/about" className="cta-button">
          Join the Adventure!
        </Link>
      </div>
    </div>
  );
}
