# What Is This?

This is github repository for the club website for the Anteater Adventure Club (AAC). AAC is a social adventure club at UCI with the mission of fostering a sense of community while making nature as accessible as possible. This website is built in React, Next.js, possibly Tailwind CSS and shadcn/ui (TBD).

# To Do

### Tech Stack / Code Organization
- [ ] Make sure current [Next.js](https://nextjs.org/) version matches original HTML version
- [ ] Convert polaroid & popup to shared component(s)
  - [ ] Make sure popup works
- [ ] Properly set up fonts using [next/fonts](https://nextjs.org/docs/app/getting-started/fonts)
- [ ] Convert current CSS to [Tailwind CSS](https://tailwindcss.com/) (optional)
- [ ] Add [shadcn/ui](https://ui.shadcn.com/), or other component library (optional)

### Information + Styling
- [ ] Add club overview & action items to the home page
- [ ] Add membership info to the membership page
- [ ] Add more events + images to the gallery page
- [ ] For all pages, improve styling

### Questions
- [ ] Should our links (discord, instagram, linktree) go in the footer, the membership page, the home page, and/or other pages?

# File Layout

- `public/` (all non-text data)
  - `fonts/`
  - `images/`
    - `board/`
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
    - `boardMembers.ts`
    - `events.ts`
  - `types.d.ts` (all types, used throughout the codebase)
- ... (config files)