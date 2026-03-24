import "./page.css";

export default function Sponsors() {
  return (
    <div className="sponsors-page">
      <section className="text-center">
        <h1>Partner With AAC</h1>
        <p className="hero-subtitle">
          Anteater Adventure Club brings students together through hikes, city
          explorations, picnics, and quarterly retreats. Sponsorship helps us
          keep outdoor experiences accessible, inclusive, and memorable.
        </p>
        <div className="sponsors-actions">
          <a
            href="mailto:anteateradventureclub@gmail.com?subject=Sponsorship%20Inquiry"
            className="button cta-button"
          >
            Email Us
          </a>
          <a
            href="https://www.instagram.com/anteateradventureclub/"
            className="button outline-button"
            target="_blank"
            rel="noopener noreferrer"
          >
            Message on Instagram
          </a>
        </div>
      </section>

      <section className="sponsor-reasons">
        <div className="text-center">
          <h2>Why Sponsor Us</h2>
        </div>
        <ul>
          <li>
            <strong>Active student community:</strong> Connect with highly
            engaged UCI students who value adventure, wellness, and local
            exploration.
          </li>
          <li>
            <strong>Brand visibility:</strong> Sponsors can be highlighted
            through event shoutouts, social media, and club materials throughout
            the quarter.
          </li>
          <li>
            <strong>Community impact:</strong> Your support helps reduce
            participation barriers and makes outdoor activities more accessible
            for students.
          </li>
        </ul>
      </section>

      <section>
        <div className="text-center">
          <h2>Ways to Partner</h2>
        </div>
        <div className="options-grid">
          <article className="option-card">
            <h3>Event Sponsorship</h3>
            <p>
              Help fund transportation, permits, and logistics for day trips,
              picnics, and special events.
            </p>
          </article>
          <article className="option-card">
            <h3>Product or Gear Support</h3>
            <p>
              Provide snacks, hydration, or outdoor gear for events, giveaways,
              or member use.
            </p>
          </article>
          <article className="option-card">
            <h3>Retreat Support</h3>
            <p>
              Sponsor our quarterly retreats to help students participate in
              larger weekend outdoor experiences.
            </p>
          </article>
          <article className="option-card">
            <h3>Custom Collaborations</h3>
            <p>
              Interested in something unique? We&apos;re happy to discuss
              tailored partnerships that align with your goals.
            </p>
          </article>
        </div>
      </section>

      <div className="sponsor-contact-container">
        <section className="sponsor-contact">
          <h2>How to Contact Us</h2>
          <p>We&apos;d love to learn about your organization and goals.</p>
          <div className="contact-list">
            <p>
              <strong>Email:</strong>{" "}
              <a href="mailto:anteateradventureclub@gmail.com">
                anteateradventureclub@gmail.com
              </a>
            </p>
            <p>
              <strong>Instagram:</strong>{" "}
              <a
                href="https://www.instagram.com/anteateradventureclub/"
                target="_blank"
                rel="noopener noreferrer"
              >
                @anteateradventureclub
              </a>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
