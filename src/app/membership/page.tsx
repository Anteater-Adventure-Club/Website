"use client";

import Link from "next/link";
import "./page.css";

export default function Membership() {
  return (
    <div className="membership">
      <div className="text-center">
        <h1>AAC Membership</h1>
      </div>

      {/* Pricing Section */}
      <div className="pricing-section">
        <div className="pricing-main">
          <div className="free-activities">
            <h2>Weekly activities are completely free!!</h2>
            <p className="retreat-note">
              Membership is ONLY necessary for the quarterly retreat
            </p>
          </div>

          <div className="price-card">
            <span className="price-number">$25</span>
            <span className="price-period">per quarter*</span>
            <span className="price-note">
              *Can pay anytime during the quarter
            </span>
            <span className="price-surcharge">+ $5 non-student surcharge</span>
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="benefits-section">
        <h2>Why Pay for Membership?</h2>
        <div className="benefits-list">
          <div className="benefit-item">
            <div className="benefit-number">1</div>
            <div className="benefit-content">
              <h3>Access to the Quarterly Camping Retreat!</h3>
              <p>
                Join us for our amazing quarterly retreats - often the highlight
                of the quarter!
              </p>
            </div>
          </div>
          <div className="benefit-item">
            <div className="benefit-number">2</div>
            <div className="benefit-content">
              <h3>Priority Carpool Assignments</h3>
              <p>
                While we usually have space, typically only 20% of attendees
                drive. Membership ensures you&apos;ll have a space!
              </p>
            </div>
          </div>
          <div className="benefit-item">
            <div className="benefit-number">3</div>
            <div className="benefit-content">
              <h3>Access to Driver Reimbursements</h3>
              <p>Amounts are TBD depending on end of quarter finances.</p>
            </div>
          </div>
          <div className="benefit-item">
            <div className="benefit-number">4</div>
            <div className="benefit-content">
              <h3>Voting Access on Club Decisions</h3>
              <p>
                Any membership in the 25-26 academic year grants access to board
                elections, as well as potential voting rights for event and
                retreat details.
              </p>
            </div>
          </div>
          <div className="benefit-item">
            <div className="benefit-number">5</div>
            <div className="benefit-content">
              <h3>Help Contribute to Club Events & Camping Gear</h3>
              <p>
                Your membership helps us fund all of our awesome events and
                maintain camping gear that we loan to members.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Payment CTA */}
      <div className="payment-cta">
        <Link
          href="https://tinyurl.com/AACW26Membership"
          className="button payment-button"
          target="_blank"
        >
          Pay Membership Fee
        </Link>
      </div>
    </div>
  );
}
