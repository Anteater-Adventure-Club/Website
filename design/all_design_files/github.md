repo: Anteater-Adventure-Club/Website
branch: main
path: src

## Also built from
repo: gdodge0/aac-drivers
branch: main
path: frontend/src, backend

## Last sync
date: 2026-10-02T04:44:18Z

### Updated in this project
- Cross-checked every portal page and API route against the screens
- Added account menu with Sign Out (10a) and Register a Driver (10b)
- Roster search, filter and per-driver membership switch in 1n
- Officers page merged into the Board Page editor (9a)

## Sync history
- 2026-10-01T23:22:24Z: round 4 (About, Board, Events on phone)
- 2026-10-01T22:43:33Z: round 3 (My AAC, membership, officer tools)
- 2026-10-01T21:53:14Z: round 2 (event editor, retreat type, signup questions)
- 2026-10-01T21:09:10Z: first pass canvas (Home, Events, Event hub, Check-in, Carpools, Reimbursements)

## Screen map
| Screen | Source files |
| --- | --- |
| 1a/1c Home | Website: src/app/page.tsx, page.css |
| 1b Events | Website: src/app/events/page.tsx, src/components/UpcomingCalendar, PolaroidGallery, src/lib/eventsDb.ts |
| 1d Recap & Gallery | aac-drivers: pages/EventManagement.vue, pages/ClubEvent.vue (recap) |
| 1e–1h Event hub | aac-drivers: pages/ClubEvent.vue, components/SignupForm.vue |
| 1i–1l Check-in / Carpools | aac-drivers: pages/CheckIn.vue, pages/EventManagement.vue (Carpools tab) |
| 1m Trips & Mileage | aac-drivers: pages/Events.vue (Mileage), pages/Attendance.vue |
| 1n Quarter close-out | aac-drivers: pages/Overview.vue, Roster.vue, Payments.vue, backend/calculations.py |
| 1o Record payment | aac-drivers: pages/Payments.vue |
| 1p My reimbursements | aac-drivers: pages/MyReimbursements.vue |
| 2a/2b Event editor | aac-drivers: pages/EventEditor.vue, components/SignupQuestion.vue |
| 3a My AAC overview | aac-drivers: pages/MemberOverview.vue |
| 3b/3c Membership | Website: src/app/membership/page.tsx · aac-drivers: pages/ClubMembership.vue |
| 3d Profile & Cars | aac-drivers: pages/Profile.vue, components/ProfileFields.vue, PayoutFields.vue, VehicleForm.vue |
| 3e My Signups | aac-drivers: pages/MySignups.vue |
| 3f Sign In | aac-drivers: pages/SignIn.vue |
| 3g Dashboard | aac-drivers: pages/ClubOverview.vue |
| 3h Events list | aac-drivers: pages/ClubEvents.vue |
| 3i Signups tab | aac-drivers: pages/EventManagement.vue |
| 3j/3k Members, imports | aac-drivers: pages/Members.vue, components/BulkImport.vue |
| 3m Settings | aac-drivers: components/QuarterForm.vue, pages/Settings.vue |
| 3n Check-in picker | aac-drivers: pages/CheckIn.vue |
| 4a About | Website: src/app/about/page.tsx, page.css |
| 4b Board | Website: src/app/board/page.tsx, src/data/officers.ts, previousOfficers.ts |
| 4c Events phone | Website: src/app/events/page.tsx |
| 5a/5b Home + About | Website: src/app/page.tsx, src/app/about/page.tsx |
| 6a–6j Event tabs, desk dialogs, payouts | aac-drivers: pages/EventManagement.vue, CheckIn.vue, Payments.vue, Overview.vue |
| 7a–7f Officer phone, member details | aac-drivers: pages/ClubOverview.vue, ClubEvents.vue, Members.vue |
| 8a–8h States, 404, create quarter | aac-drivers: components/ClubFeedback.vue, QuarterForm.vue |
| 9a Officers & Board editor | aac-drivers: pages/Officers.vue · Website: src/data/officers.ts, previousOfficers.ts |
| 10a Account menu | aac-drivers: components/NavigationContent.vue |
| 10b Register driver | aac-drivers: pages/Roster.vue |
