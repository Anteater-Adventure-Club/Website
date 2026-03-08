# Anteater Adventure Club Website 🌲🏕️🥾

This is the GitHub repository for the Anteater Adventure Club's (AAC) official website. AAC is an official UCI organization with the mission to foster a sense of community while making nature as accessible as possible for our college community! 

This project redesigns AAC's digital presence by:
- **Centralizing** event information
- **Improving** event sign-up flows
- **Showcasing** past adventures in a media gallery
- **Introducing** the board members
- **Providing** clear membership details and registration

## Tech Stack

- **Frontend:** Next.js (App Router), React, TypeScript, CSS
- **Backend:** Next.js API Routes (REST)
- **Database:** Supabase (PostgreSQL)
- **Deployment:** Vercel
- **Tooling:** ESLint, npm

## Page Previews

### 🏠 Home Page
<img src="https://github.com/user-attachments/assets/924a33af-6adc-4355-b0a8-40abe2e3e82e" align="right" width="500">

The Home Page serves as the primary hub for AAC members. Key features include:
* **Dynamic Event Spotlights:** A real-time display of some of the recent events, styled as polaroids that automatically refresh.
* **Streamlined Navigation:** A direct link to the full Events Page, making it easy to see the calendar and sign up for upcoming trips.

<br clear="right"/>

### 🌲 About Page
<img src="https://github.com/user-attachments/assets/17ba71d3-dec6-4c19-960a-8aa29ddae308" align="right" width="500">

The About Page showcases our mission and the core activities of AAC:
* **Club Activities:** A gallery of our primary events, including local hikes, city explorations, and our weekly potluck picnics in Aldrich Park.
* **Quarterly Retreats:** Highlighting our larger quarterly trips where members get away for a full weekend of nature and exploration.
* **Socials:** Direct links at the bottom of the page to join our community Discord and follow our Instagram for the latest updates.

<br clear="right"/>

### 🗓️ Events Page
<>

The Events Page serves as the central hub for all club activities:
* **Upcoming Event's Calendar:** A monthly view that makes it easy to find and sign up for our next hikes and trips.
* **Past Event Gallery:** A collection of photos from our previous outings, which acts as club archive.
* **Backend Integration:** A custom-built system that automatically handles moving events from the calendar to the past events section once the event has happened.

<br clear="right"/>

### 🤝 Board Page
<img src="https://github.com/user-attachments/assets/0a8d6c9b-0f3c-4719-be56-caaade7e6678" align="right" width="500">

The Meet the Board Page introduces the student leaders behind AAC:
* **Interactive Polaroids:** A grid of board members styled as polaroids that display their names and specific leadership positions.
* **Member Info:** Clicking on photo reveals more personal details, such as their major, their reason for joining AAC, their favorite AAC memory and a direct link to their Instagram
* **Past Board Archive:** A section at the bottom of the page that preserves a record of board members from previous academic years.

<br clear="right"/>
  
### ✍️ Membership Page

<img src="https://github.com/user-attachments/assets/9ac25f62-04a5-46f1-823d-0aa070f7ebe4" align="right" width="500">

The Membership Page explains how students can officially join the AAC community:
* **Membership Overview:** Clear details on what it costs to join and the specific benefits of being a member.
* **Funding Transparency:** A breakdown of how membership fees directly support club gear, trips, and upcoming events.
* **Direct Registration:** A button at the bottom that links directly to our membership and payment form.

<br clear="right"/>

## File Layout

- `public/` = static assets served by Next.js
  - `fonts/` = custom fonts
  - `images/`
    - `events/` = event photos grouped by academic year
    - `officers/` = board member photos
  - `logos/` = social/brand icons

- `src/` = application source code
  - `app/` = Next.js App Router pages and route handlers
    - `about/`, `board/`, `events/`, `membership/` = page routes
    - `api/events/` = REST API endpoints for event CRUD + seeding
    - `link/[slug]/` = short-link redirect route
    - `layout.tsx`, `page.tsx`, `globals.css` = app shell + home page
  - `components/` = reusable UI components
    - `Header/`, `Footer/`, `PolaroidCard/`, `PolaroidGallery/`, `Popup/`, `UpcomingCalendar/`
  - `data/` = seed/static content used by the app
    - `upcomingEvents.ts`, `pastEvents.ts`, `officers.ts`, `previousOfficers.ts`
  - `lib/` = backend/data access logic
    - `eventsDb.ts` = database adapter used by API routes
  - `types.d.ts` = shared TypeScript types/interfaces

- `supabase/` = database setup scripts
  - `events_schema.sql` = SQL schema for the `events` table and related setup

- root config files
  - `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `.env.example`

- `data/` (project root) = local runtime DB artifacts for development (if generated)

