import type { Schema } from "./api";

export type Permission = Schema<"OfficerAccess">["permissions"][number];
export const permissionLabels: Record<Permission, string> = {
  events: "Events & Recaps",
  participation: "Check-in & Carpools",
  members: "Members & Dues",
  reimbursements: "Reimbursements",
  board: "Board Profiles",
};
export const permissionDescriptions: Record<Permission, string> = {
  events: "Edit and publish events, recurring schedules, photos, and recaps.",
  participation:
    "Manage signups, walk-ins, check-in, cards, carpools, and participant imports/exports.",
  members:
    "Manage member records, dues, member imports, and external application reviews.",
  reimbursements:
    "Manage drivers, trips, mileage, and payment records. Budget and quarter closing require a full officer.",
  board:
    "Manage public board profiles, photos, and board years. Officer access stays with full officers.",
};
type Session = Schema<"SessionView"> | undefined;
export function can(session: Session, ...permissions: Permission[]) {
  if (
    !session?.member ||
    (session.member.approval_status &&
      session.member.approval_status !== "approved")
  )
    return false;
  if (session.officer) return true;
  const access = session.officer_access;
  return (
    access?.kind === "guest" &&
    permissions.some((p) => access.permissions.includes(p))
  );
}
export function hasTools(session: Session) {
  return can(session, ...(Object.keys(permissionLabels) as Permission[]));
}
export function canVisit(session: Session, path: string) {
  if (can(session)) return true;
  if (
    /^\/admin\/events\/.+\/(check-in|seat)$/.test(path) ||
    path === "/admin/check-in"
  )
    return can(session, "participation");
  if (
    path === "/admin/events/new" ||
    path.endsWith("/edit") ||
    path.startsWith("/admin/series/")
  )
    return can(session, "events");
  if (path === "/admin/events" || path.startsWith("/admin/events/"))
    return can(session, "events", "participation", "reimbursements");
  if (path === "/admin/members") return can(session, "members");
  if (path === "/admin/reimbursements") return can(session, "reimbursements");
  if (path === "/admin/officers") return can(session, "board");
  return false;
}
export function officerHome(session: Session) {
  return (
    [
      "/admin/overview",
      "/admin/events",
      "/admin/check-in",
      "/admin/members",
      "/admin/reimbursements",
      "/admin/officers",
    ].find((path) => canVisit(session, path)) || "/my-aac"
  );
}
export function eventTabAllowed(session: Session, tab: string) {
  if (tab === "recap") return can(session, "events");
  if (tab === "trips") return can(session, "reimbursements");
  if (tab === "google-sheets") return can(session);
  return (
    ["signups", "carpools", "check-in-log", "questions"].includes(tab) &&
    can(session, "participation")
  );
}
