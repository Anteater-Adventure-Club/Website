import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router";

type Section = { id: string; title: string; content: ReactNode };

function Contact() {
  return (
    <p>
      Contact AAC officers at{" "}
      <a href="mailto:anteatereateradventureclub@gmail.com">
        anteatereateradventureclub@gmail.com
      </a>{" "}
      for privacy requests, questions, or corrections. For an account request,
      identify your club account and describe what you need. Never send a
      password or full payment credentials.
    </p>
  );
}

function LegalPage({
  kind,
  title,
  introduction,
  sections,
}: {
  kind: "privacy" | "terms";
  title: string;
  introduction: ReactNode;
  sections: Section[];
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const section = document.getElementById(window.location.hash.slice(1));
    if (section) {
      section.scrollIntoView();
    } else {
      window.scrollTo(0, 0);
      heading.current?.focus({ preventScroll: true });
    }
  }, [title]);

  return (
    <article className="page legal-page" aria-labelledby="legal-title">
      <nav className="legal-navigation" aria-label="Website policies">
        <Link
          to="/privacy"
          aria-current={kind === "privacy" ? "page" : undefined}
        >
          Privacy Policy
        </Link>
        <Link to="/terms" aria-current={kind === "terms" ? "page" : undefined}>
          Terms of Service
        </Link>
      </nav>
      <header className="legal-header">
        <h1 id="legal-title" ref={heading} tabIndex={-1}>
          {title}
        </h1>
        <p className="legal-date">
          Last updated <time dateTime="2026-10-05">October 5, 2026</time>
        </p>
        {introduction}
      </header>
      <nav className="legal-contents" aria-label={`${title} contents`}>
        <h2>On this page</h2>
        <ol>
          {sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`}>{section.title}</a>
            </li>
          ))}
        </ol>
      </nav>
      {sections.map((section) => (
        <section
          className="legal-section"
          id={section.id}
          key={section.id}
          aria-labelledby={`${section.id}-heading`}
        >
          <h2 id={`${section.id}-heading`}>{section.title}</h2>
          {section.content}
        </section>
      ))}
    </article>
  );
}

const privacySections: Section[] = [
  {
    id: "information",
    title: "Information we collect",
    content: (
      <>
        <ul>
          <li>
            <strong>Account and profile:</strong> your name, email, Google
            account identifier, and details you provide, such as phone number,
            pronouns, Discord username, student status, and driving preferences.
          </li>
          <li>
            <strong>Events and carpools:</strong> signups, answers and notes,
            attendance, ride choices, car assignments, and vehicle details such
            as year, make, model, color, license plate, and passenger capacity.
          </li>
          <li>
            <strong>Membership and reimbursements:</strong> dues status, payment
            amounts, dates, methods and references, driving trips, estimated and
            finalized payouts, and payout details you provide, such as a payment
            handle and phone-number suffix.
          </li>
          <li>
            <strong>Published club content:</strong> board names, roles, bios
            and photos, majors, memories and social links, plus event photos and
            recaps selected for publication.
          </li>
          <li>
            <strong>Technical records:</strong> IP addresses, browser and
            request information, session cookies, error logs, and records of
            sign-in and administrative actions used to operate and protect the
            site.
          </li>
        </ul>
        <p>
          Information comes from you, Google sign-in, and club officers who
          enter or import club records, including historical membership and
          attendance records. Officers may also use the public UCI directory to
          look up a name associated with a UCI email address.
        </p>
      </>
    ),
  },
  {
    id: "use",
    title: "How we use information",
    content: (
      <p>
        We use information to create and authenticate accounts, maintain member
        records, coordinate events and carpools, verify dues, calculate and
        record reimbursements, publish club content, respond to questions, and
        investigate errors, abuse, or unauthorized activity. We do not sell
        personal information or use it for targeted advertising.
      </p>
    ),
  },
  {
    id: "google",
    title: "Google sign-in",
    content: (
      <>
        <p>
          Website sign-in uses your UCI Google account, or another Google
          account if you do not have a UCI email. Google provides your account
          identifier, name, email address, and verification information so we
          can recognize you and connect you to your club records. We do not
          receive your Google password or request access to your Gmail messages,
          Google Drive files, contacts, or calendar.
        </p>
        <p>
          You can remove the site’s access in your{" "}
          <a href="https://myaccount.google.com/connections">
            Google account connections
          </a>
          . This does not automatically delete club records already stored by
          AAC; contact us to request their deletion.
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Who can see information",
    content: (
      <>
        <ul>
          <li>
            <strong>Club officers</strong> can access member profiles, contact
            information, signups and answers, vehicle and attendance records,
            and financial records to run the club. Authorized site
            administrators may access records for maintenance and support.
          </li>
          <li>
            <strong>Carpool participants</strong> can see their assigned
            driver’s name, vehicle details including the license plate, and
            first names of other riders in that car. Private signup answers and
            payout details are not displayed to other members.
          </li>
          <li>
            <strong>Public visitors</strong> can see published board profiles,
            photos, and event recaps. Public pages do not display the private
            member directory, signup roster, or financial records. Public
            content may also appear in search results and link previews.
          </li>
          <li>
            <strong>Service providers</strong> process information needed for
            their services, including Google for sign-in, Cloudflare for traffic
            delivery and security, and infrastructure used to host the website,
            database, and backups.
          </li>
          <li>
            <strong>Emergency services and UCI personnel</strong> may receive
            relevant information when reasonably necessary to respond to an
            emergency, protect someone’s health or safety, coordinate club
            activities with UCI, or meet university or legal requirements. We
            limit these disclosures to information relevant to those purposes.
          </li>
        </ul>
        <p>
          We may disclose information when legally required or when reasonably
          necessary to address fraud, security incidents, or threats to safety.
          Payment apps, Discord, Instagram, and other linked services have their
          own privacy policies when you use them.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and tracking",
    content: (
      <>
        <p>
          We use an essential session cookie to keep you signed in and complete
          Google sign-in securely. Website sign-in expires after eight hours;
          signing out clears the session. Blocking cookies may prevent sign-in
          and account features from working. Cloudflare and Google may use
          cookies or similar technology to deliver their security and sign-in
          services.
        </p>
        <p>
          The website does not use advertising trackers or cross-site behavioral
          analytics. It does not change its behavior in response to a browser’s
          “Do Not Track” signal. Linked third-party services may collect
          information under their own policies when you visit them.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "Storage and security",
    content: (
      <>
        <p>
          We store club records in our database and media storage and maintain
          backups for recovery. Records may be kept across academic quarters for
          club administration, financial reconciliation, historical records, and
          security. We retain information as needed for those purposes and
          applicable legal obligations; there is no automatic account-deletion
          deadline.
        </p>
        <p>
          We use HTTPS, authenticated access, and officer-only tools to help
          protect private information. No website or storage system can
          guarantee complete security. Removing a saved vehicle or canceling a
          signup does not erase historical trip, attendance, or audit records.
        </p>
      </>
    ),
  },
  {
    id: "choices",
    title: "Your choices and requests",
    content: (
      <>
        <p>
          You can browse public pages without signing in, update your profile
          and saved vehicles in My AAC, and edit or cancel signups while the
          event permits it. Optional profile fields may be left blank. Please
          avoid entering sensitive information in signup notes unless needed for
          the event.
        </p>
        <p>
          Contact us to request access to, correction of, or deletion of your
          personal information, or to raise a concern about a published photo or
          profile. We may verify your identity before acting on a request. Some
          records may need to be retained for financial, legal, or security
          purposes. Backup copies may remain until replaced, and we cannot
          remove copies others have already downloaded or reposted.
        </p>
        <Contact />
      </>
    ),
  },
  {
    id: "children",
    title: "Children’s privacy",
    content: (
      <p>
        The site is intended for a university club community and is not directed
        to children under 13. If you believe a child under 13 has provided
        personal information, contact us so we can investigate and address it.
      </p>
    ),
  },
  {
    id: "privacy-changes",
    title: "Changes and questions",
    content: (
      <>
        <p>
          We will post updates on this page and change the date above. For
          material changes to how we use or disclose personal information, we
          will provide a prominent website notice or notify affected members,
          and obtain consent when required. Questions about this policy can be
          directed to AAC officers using the contact options above.
        </p>
        <p>
          See our <Link to="/terms">Terms of Service</Link> for website-use
          rules.
        </p>
      </>
    ),
  },
];

const termsSections: Section[] = [
  {
    id: "using-site",
    title: "Using the website",
    content: (
      <p>
        These terms cover the AAC website and its account, membership, event,
        carpool, and reimbursement tools. By using those services, you agree to
        these terms. If you do not agree, please stop using the services. Event
        instructions, club rules, and any separately provided participation
        forms or waivers also apply to the activities they cover.
      </p>
    ),
  },
  {
    id: "accounts",
    title: "Accounts and accurate records",
    content: (
      <p>
        Use your UCI Google account to sign in if you have one. If you do not
        have a UCI email, choose that option on the sign-in page to use another
        Google account. Use your own account and the same email each time, and
        provide accurate contact, vehicle, signup, and payment information. Keep
        your Google account secure and sign out on shared devices. Officer
        access is limited to authorized officers. Report suspected account
        misuse or incorrect records to the club.
      </p>
    ),
  },
  {
    id: "membership-payments",
    title: "Membership and payments",
    content: (
      <>
        <p>
          General participation and paid membership follow the rules published
          on the <Link to="/membership">Membership page</Link> and individual
          event pages. Dues apply to the stated academic quarter. Submitting a
          payment confirmation does not itself approve membership; an officer
          must confirm the record or grant an authorized exception.
        </p>
        <p>
          Payments are made outside this website using the methods listed by the
          club. The site records payments and payout details; it does not
          process card payments or ask for card numbers. Ask officers about
          refunds, duplicate payments, or disputed records. Any separately
          stated payment or refund conditions and applicable law govern those
          requests.
        </p>
      </>
    ),
  },
  {
    id: "events-carpools",
    title: "Events and carpools",
    content: (
      <>
        <p>
          Review each event’s schedule, eligibility, packing list, and transport
          rules. Arrive on time and update or cancel your signup if your plans
          change. Paid-member priorities and seat-release rules follow the
          published event and membership information. Weather, safety, available
          drivers, or other circumstances may require changes or cancellation;
          confirm the latest information before traveling.
        </p>
        <p>
          Drivers must provide accurate vehicle and passenger-capacity details,
          hold the license and insurance required by law, and operate a safe,
          roadworthy vehicle. Do not exceed available seat belts or passenger
          capacity. Riders and drivers must follow traffic laws and reasonable
          event safety instructions. A website signup or car assignment is not a
          certification of a driver’s qualifications or vehicle condition.
        </p>
        <p>
          Outdoor activities and travel involve risks. Choose activities suited
          to your abilities, bring appropriate supplies, and tell an officer
          about an immediate safety concern. These website terms do not replace
          any separate activity waiver or participation agreement.
        </p>
      </>
    ),
  },
  {
    id: "reimbursements",
    title: "Driver reimbursements",
    content: (
      <p>
        Reimbursement eligibility follows membership for the relevant quarter
        and the club’s published reimbursement rules. Amounts depend on verified
        trips, recorded mileage and rates, any applicable cap, and the available
        quarter budget. Estimates can change before officers finalize payouts.
        An estimate is not a promise to repay all driving costs. Payments are
        made outside the site after the club’s review and finalization process.
        Report errors before the quarter is finalized whenever possible.
      </p>
    ),
  },
  {
    id: "conduct",
    title: "Respectful and responsible use",
    content: (
      <>
        <p>
          Do not impersonate another person, submit false attendance or payment
          records, harass others, or use the site for unlawful activity. Do not
          attempt to bypass access controls, disrupt the service, or collect or
          disclose private member information without authorization. Use
          information you receive through club tools only for legitimate club
          coordination and respect other members’ privacy.
        </p>
        <p>
          We may restrict website or officer access to address misuse, security
          concerns, or loss of eligibility. Contact officers if you believe a
          restriction or record is mistaken.
        </p>
      </>
    ),
  },
  {
    id: "content",
    title: "Content and outside services",
    content: (
      <>
        <p>
          Submit only content you have the right to provide. You retain your
          rights in submitted content and allow AAC to store and use it as
          needed for the club features for which you provide it, including
          publishing material supplied for public board profiles or event
          recaps. A private signup note is not permission to publish it. Contact
          officers about corrections or concerns about a photo.
        </p>
        <p>
          Club branding, photos, and other website content may belong to AAC or
          their respective creators. Ask before reusing content unless a license
          or applicable law permits your use. Links to Google, payment apps,
          Discord, Instagram, or other services are subject to those services’
          own terms and privacy policies.
        </p>
      </>
    ),
  },
  {
    id: "availability",
    title: "Availability and your rights",
    content: (
      <p>
        We work to keep the website and its records useful and accurate, but
        access may be interrupted and mistakes may occur. To the extent
        permitted by law, the site is provided as available without a guarantee
        of uninterrupted service or error-free information. Confirm important
        event, safety, or payment details with officers. Nothing in these terms
        excludes rights or responsibilities that cannot lawfully be excluded.
      </p>
    ),
  },
  {
    id: "terms-contact",
    title: "Privacy, changes, and contact",
    content: (
      <>
        <p>
          Our <Link to="/privacy">Privacy Policy</Link> explains how we handle
          personal information. We may update these terms by posting a revised
          version and changing the date above. We will give a prominent website
          notice or notify affected members of material changes. Changes apply
          going forward and do not remove rights that have already accrued.
        </p>
        <Contact />
      </>
    ),
  },
];

export function PrivacyPolicy() {
  return (
    <LegalPage
      kind="privacy"
      title="Privacy Policy"
      introduction={
        <p>
          Anteater Adventure Club at UC Irvine (“AAC,” “we,” or “us”) operates
          anteateradventureclub.com and the AAC website addresses that redirect
          here. This policy explains how we handle information when you browse
          the site or use its club tools.
        </p>
      }
      sections={privacySections}
    />
  );
}

export function TermsOfService() {
  return (
    <LegalPage
      kind="terms"
      title="Terms of Service"
      introduction={
        <p>
          Welcome to Anteater Adventure Club at UC Irvine (“AAC,” “we,” or
          “us”). These terms explain the rules for using
          anteateradventureclub.com and the club tools available through it.
        </p>
      }
      sections={termsSections}
    />
  );
}
