# Anteater Adventure Club — Design System

The **Anteater Adventure Club (AAC)** is an official UCI student organization founded to foster a safe and inclusive community for people to appreciate the outdoors, making nature as fun and accessible as possible for all UCI students. Activities: weekly local hikes, city explorations, weekly potluck picnics in Aldrich Park, and quarterly weekend camping retreats (Sequoia, Death Valley, Zion, Joshua Tree…).

**Product surface:** one — the club's marketing/info website (Next.js App Router, React, TypeScript, plain CSS + Tailwind preflight, Supabase events DB, Vercel). Pages: Home, About, Events, Board, Membership, Sponsors.

## Sources
- GitHub: https://github.com/Anteater-Adventure-Club/Website (branch `main`). Key files: `src/app/globals.css` (tokens), `src/components/*` (Header, Footer, PolaroidCard, PolaroidGallery, Popup, UpcomingCalendar), `src/app/*/page.css|tsx`, `src/data/*.ts` (copy).
- Explore that repo further when building new designs — real copy, event data and page structure live there.

## Index
- `styles.css` — entry point (imports only)
- `tokens/` — `fonts.css`, `colors.css`, `typography.css`, `layout.css` (spacing, radii, shadows, blur, motion), `base.css` (element defaults: Tailwind preflight + site globals)
- `components/components.css` — all component class rules (`aac-` prefix)
- `components/` — React primitives (below), each with `.d.ts`, `.prompt.md`, and a card
- `ui_kits/website/` — click-through recreation of all six pages
- `guidelines/` — foundation specimen cards (Colors, Type, Spacing, Brand)
- `assets/logos/` — discord.svg, instagram.svg, instagram_white.svg
- `assets/images/events/` — 16 event photos (24-25, 25-26); `assets/images/officers/` — 8 officer photos incl. blank_profile.jpg
- `fonts/` — Lazydog.otf, Chivo-Regular.ttf, Chivo-Italic.ttf
- `thumbnail.html`, `SKILL.md`, `github.md`

## Components
From source (`src/components`): **Header**, **Footer**, **PolaroidCard**, **PolaroidGallery**, **Popup** (event + officer modes), **UpcomingCalendar**.
Extracted from repeated page patterns: **Button** (`.button` + cta/outline/payment/discord/instagram), **GlassCard** (frosted panels + option cards), **PriceCard**, **BenefitItem** (membership page), **PreviousBoard** (board page accordion).

### Intentional additions
- **Icon** — wraps the two Lucide glyphs the site uses (Menu, X) so components don't need the lucide-react package.

## CONTENT FUNDAMENTALS
- **Voice:** friendly, upbeat student-club voice. "We/us/our" for the club, "you" for the reader. Personal and casual — officers write first-person bios ("Liam dragged me out to the Zion retreat…").
- **Exclamation marks everywhere** — headings and CTAs end in "!" or "...": "Join the Adventure!", "Meet the Board!", "Stay up to date!", "Our Mission...", "Weekly activities are completely free!!".
- **Casing:** Title Case for headings, buttons and nav ("Pay Membership Fee", "Why Pay for Membership?", "Upcoming Events"). Sentence case for subtitles and body.
- **Subtitles** are short instructions in h4: "Click to learn more about each officer!", "Click on any date or past event to learn more!".
- **Emphasis by caps** occasionally: "Membership is ONLY necessary for the quarterly retreat".
- **Event copy** is past-tense recap with place names + a highlight: "On Sunday, AAC took a trip to Griffith Park and the Observatory! We enjoyed the scenic views of LA…". Collabs styled "AAC x Ocean Club: Surfing @ Newport Beach"; "@" for locations.
- **Tagline:** "Fostering a sense of community while making nature as accessible as possible!" / footer "Making Nature Accessible!".
- **Emoji:** UI uses only the 🌲 in the footer; an occasional emoji appears inside officer-written bios (🌴). Don't add emoji elsewhere.
- Sponsor page is slightly more formal but still warm ("We'd love to learn about your organization and goals.").

## VISUAL FOUNDATIONS
- **Colors:** warm off-white **tan `#f8f5f0`** page, **forest `#1f4d3b`** primary (buttons, price card, active nav, mobile drawer, card titles), forest-light `#2f6b53` hover, sage `#7da27f` accent (defined, rarely used), ink `#2a2a2a` text, greys #333/#555/#666 for nav/muted/footer. Calendar uses Tailwind-ish pastels (yellow event, blue meeting, green picnic, red today dot). Social buttons use Discord/Instagram brand colors. Each officer popup has a bespoke pastel bg + saturated title color (`--officer-<id>-bg/-<id>`).
- **Type:** **Lazydog** (hand-lettered, playful) for every h1/h2/h3, the primary CTA and the price number; **Chivo** regular/italic for body, nav and UI. h1 4rem (+1px tracking), h2 2.5rem, h3 1.5rem; mobile (≤896px) 2.5/2/1.25rem, p 0.9rem. h4 is unstyled Chivo 1rem, used as subtitle. Line-height 1.6 on paragraphs. Headings have no margins (Tailwind preflight) — spacing comes from flex gaps.
- **Backgrounds:** flat tan everywhere. No gradients, textures, patterns or illustrations. Imagery comes only from photos inside polaroids.
- **Signature motif: polaroids.** White frame, 1rem padding, square corners, `0 4px 8px rgba(0,0,0,.2)` shadow, Lazydog title + date/role caption underneath. On Home they appear as a pair tilted −4°/+4° that swaps every 9s with a fade/drop.
- **Glass panels:** content blocks are translucent white (60–85%) with `backdrop-filter: blur(8–12px)`, 1px `rgba(0,0,0,.08)` border, 1.5rem radius. The fixed header is the same glass (60% → 85% on hover, blur 12px).
- **Corner radii:** pill 999px for all buttons; 1.5rem panels; 1.25rem accordion toggle; 1.1rem option cards; 1rem popups and small items; 0.5rem calendar tiles; 0 for polaroids.
- **Shadows:** soft and neutral `0 10–20px 25–40px rgba(0,0,0,.08)` on hover lifts and big panels; forest-tinted `rgba(31,77,59,.25)` shadows under forest CTAs and the price card. No inner shadows.
- **Borders:** hairline 8% black on glass; calendar uses solid 1px #333 tiles and nav buttons (a more utilitarian look).
- **Hover states:** buttons lighten forest→forest-light and lift `translateY(-2px/-3px)`; cards lift −3/−4px and gain shadow; polaroids `scale(1.05)`; Instagram icon `scale(1.2)`; nav links turn forest; links drop to 0.8 opacity. Transitions 0.2–0.3s `ease`. No press/active states defined.
- **Animation:** page transitions via framer-motion — fade + 40px rise + 0.98 scale, 0.45s `cubic-bezier(0.4,0,0.2,1)`. Mobile drawer slides in 0.3s. No bounces or springs.
- **Layout:** fixed 4.5rem header; main padding 3rem (top = header + 2rem); centered content with max-widths 48–80rem; About alternates text/images left-right; galleries are `auto-fit minmax(250px,1fr)` grids. Breakpoints 640 (hamburger), 768, 896, 1000/1024px.
- **Transparency/blur:** only on header, glass panels, and black scrims (60% popup, 50% mobile menu).
- **Imagery vibe:** candid phone photos of group trips — natural, sunny SoCal color, unfiltered, no grain or b&w.
- **Active nav:** bold forest text + 2px forest underline 6px below.

## ICONOGRAPHY
- **Lucide** (lucide-react) is the only icon library, used for just two glyphs: `Menu` and `X` (24px, 2px stroke). Recreated in `components/core/Icon.jsx` with copied path data; for other icons use Lucide from CDN (https://unpkg.com/lucide-static) to match.
- **Brand SVG logos** for socials: `assets/logos/discord.svg`, `instagram.svg` (color), `instagram_white.svg` — shown at 20px inside social buttons or 1.4rem in officer popups.
- No icon font, no PNG icons, no unicode icons — except the accordion uses literal "+" / "-" characters set in Lazydog.
- Emoji: only 🌲 in the footer.
- **No logo exists in the repo.** The brand is presented as the Lazydog wordmark "Anteater Adventure Club" (Home hero: "Anteater" at 1.7em). Do not invent a logo mark.

## Fonts
Lazydog and Chivo are the repo's own files (no substitution). Chivo ships only Regular + Italic; bold weights are browser-synthesized, as on the live site.
