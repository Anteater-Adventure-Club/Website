Add scoped member bans and member-facing restrictions

# Background

Officers need to restrict event and membership signups while members retain access to their accounts and existing records.

# The Feature

- Manage temporary or permanent bans from **Officer Tools → Members → Details**, with private officer reasons, an optional message for the member, and the ability to lift a ban.
- Apply bans to all events, selected event categories, specific events, membership signups, or a combination. Category bans also cover future events of that type.
- Filter members with the **Banned** button and show compact ban statuses in the Membership column. Existing row actions remain separate.
- Show members neutral **restriction** language. Private officer reasons and ban history remain officer-only; signing in and existing approved membership remain available.
- Enforce restrictions on new or restored event signups and new membership approvals, including officer additions, walk-ins, and imports.
- Automatically cancel matching upcoming signups for events starting during the ban. Expiry or lifting a ban does not restore cancelled signups.

# Rollout Notes

Adds the `member_bans` database migration, API contracts, and officer documentation. Existing membership adjustments continue to use **Return to General Membership**.
