# Anteater Adventure Club Website 🌲🏕️🥾

This is the GitHub repository for the Anteater Adventure Club's (AAC) official website. AAC is an official UCI organization with the mission to foster a sense of community while making nature as accessible as possible for our college community! 

This project redesigns AAC's digital presence by:
- **Centralizing** event information
- **Improving** event sign-up flows
- **Showcasing** past adventures in a media gallery
- **Introducing** the board members
- **Providing** clear membership details and registration

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

- `public/` = non-text data
  - `fonts/`
  - `images/`
    - `events` = images for all events, groped by year
    - `officers` = images for current officers
  - `logos/`
- `src/` = code/text data
  - `app/` = individual pages, i.e. `www.website.com/[page]` (e.g. about, board, events, membeship)
  - `components/` = individual UI components
  - `data/` = text data for events, current officers, and previous officers 
  - `types.d.ts` = custom types/interfaces, used throughout the codebase
- ... = config files
