# What's This?

This is github repository for the Anteater Adventure Club's (AAC) club website. AAC is a UCI organization with a mission to foster a sense of community while making nature as accessible as possible! This website is built with React, Next.js, and Tailwind CSS.

# File Layout

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