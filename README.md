# What's This?

This is github repository for the club website for the Anteater Adventure Club (AAC). AAC is a club at UCI with the mission of fostering a sense of community while making nature as accessible as possible. This website is built with React and Next.js.

# To Do

### Tech Stack / Code Organization
- [ ] Properly set up fonts using [next/fonts](https://nextjs.org/docs/app/getting-started/fonts)
- [ ] Convert current CSS to [Tailwind CSS](https://tailwindcss.com/) (optional)
- [ ] Add [shadcn/ui](https://ui.shadcn.com/), or other component library (optional)

### Information + Styling
- [ ] Add club overview & action items to the home page
- [ ] Add membership info to the membership page
- [ ] Add more events + images to the gallery page
- [ ] For all pages, improve styling
- [ ] Make the website responsive (for different screen sizes/aspect ratios)

### Questions
- [ ] Should our links (discord, instagram, linktree) go in the footer, the membership page, the home page, and/or other pages?
- [ ] On pages that don't take up the full window height (currently the about/membership/gallery pages), should the footer automatically show, or should it be just below the initial window, requiring a little bit of scrolling to see?

# File Layout

- `public/` (all non-text data)
  - `fonts/`
  - `images/`
    - `officers/`
    - `events/`
  - `logos/`
- `src/` (all code)
  - `app/` (all pages, i.e. `www.website.com/[page]`)
    - `about/`
    - `board/`
    - `gallery/`
    - `membership/`
    - ... (layout, global styles, home page)
  - `components/` (all components, used throughout the codebase)
    - `Footer/`
    - `Header/`
  - `data/` (all text data, used throughout the codebase)
    - `officers.ts`
    - `events.ts`
  - `types.d.ts` (all types, used throughout the codebase)
- ... (config files)