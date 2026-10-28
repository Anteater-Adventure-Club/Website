import { describe, expect, it } from "vitest";
import {
  can,
  canVisit,
  eventTabAllowed,
  hasTools,
  officerHome,
} from "./access";
import type { Permission } from "./access";
import type { Schema } from "./api";
function guest(...permissions: Permission[]) {
  return {
    member: { id: 2, approval_status: "approved" },
    officer: false,
    officer_access: {
      kind: "guest",
      permissions,
      expires_at: "2099-01-01T00:00:00Z",
    },
  } as Schema<"SessionView">;
}
describe("Guest navigation", () => {
  it.each([
    ["events", "/admin/events", ["recap"]],
    [
      "participation",
      "/admin/events",
      ["signups", "carpools", "check-in-log", "questions"],
    ],
    ["members", "/admin/members", []],
    ["reimbursements", "/admin/events", ["trips"]],
    ["board", "/admin/officers", []],
  ] as [Permission, string, string[]][])(
    "%s exposes only useful tools",
    (permission, home, tabs) => {
      const session = guest(permission);
      expect(officerHome(session)).toBe(home);
      expect(hasTools(session)).toBe(true);
      for (const tab of [
        "signups",
        "carpools",
        "check-in-log",
        "questions",
        "google-sheets",
        "trips",
        "recap",
      ])
        expect(eventTabAllowed(session, tab)).toBe(tabs.includes(tab));
      for (const path of ["/admin/overview", "/admin/settings"])
        expect(canVisit(session, path)).toBe(false);
      expect(can(session)).toBe(false);
    },
  );
  it("guards nested routes and composes multiple permissions", () => {
    const session = guest("participation", "members");
    expect(canVisit(session, "/admin/events/hike/3/check-in")).toBe(true);
    expect(canVisit(session, "/admin/events/hike/3/seat")).toBe(true);
    expect(canVisit(session, "/admin/events/hike/3/edit")).toBe(false);
    expect(canVisit(session, "/admin/events/new")).toBe(false);
    expect(canVisit(session, "/admin/series/2")).toBe(false);
    expect(canVisit(session, "/admin/members")).toBe(true);
    expect(canVisit(session, "/admin/officers")).toBe(false);
  });
  it("preserves full officer access and removes tools for expired or unapproved guests", () => {
    const full = { ...guest(), officer: true };
    expect(canVisit(full, "/admin/settings")).toBe(true);
    expect(officerHome(full)).toBe("/admin/overview");
    const expired = {
      ...guest(),
      officer_access: {
        kind: "none" as const,
        permissions: [],
        expires_at: null,
      },
    };
    expect(hasTools(expired)).toBe(false);
    expect(officerHome(expired)).toBe("/my-aac");
    const pending = guest("members");
    pending.member!.approval_status = "pending";
    expect(hasTools(pending)).toBe(false);
  });
});
