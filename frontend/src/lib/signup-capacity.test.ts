import { describe, expect, it } from "vitest";
import { capacityBlocked, remainingSignupSpots } from "./signup-capacity";

const event = {
  signup_cap_total: 3,
  signup_cap_driver: 1,
  signup_cap_ride: 2,
  signup_cap_own: null,
  signup_count: 2,
  signup_counts_by_role: { driver: 1, ride: 1, own: 0 },
};

describe("remaining signup spots", () => {
  it("uses the smaller of the total and category availability", () => {
    expect(
      remainingSignupSpots({ ...event, signup_cap_ride: 10 }, "ride"),
    ).toBe(1);
    expect(
      remainingSignupSpots({ ...event, signup_cap_total: 10 }, "ride"),
    ).toBe(1);
    expect(remainingSignupSpots(event, "driver")).toBe(0);
  });
  it("uses whichever limit exists and omits availability when both are unlimited", () => {
    expect(remainingSignupSpots(event, "own")).toBe(1);
    expect(
      remainingSignupSpots({ ...event, signup_cap_total: null }, "ride"),
    ).toBe(1);
    expect(
      remainingSignupSpots({ ...event, signup_cap_total: null }, "own"),
    ).toBeNull();
  });
  it("never shows negative spots when either limit is full or reduced", () => {
    for (const role of ["ride", "driver", "own"] as const) {
      expect(remainingSignupSpots({ ...event, signup_count: 3 }, role)).toBe(0);
      expect(
        remainingSignupSpots({ ...event, signup_cap_total: 0 }, role),
      ).toBe(0);
    }
    expect(
      remainingSignupSpots({ ...event, signup_cap_driver: 0 }, "driver"),
    ).toBe(0);
  });
});

describe("signup availability", () => {
  it("closes only the full transport category", () => {
    expect(capacityBlocked(event, "driver")).toBe(true);
    expect(capacityBlocked(event, "ride")).toBe(false);
    expect(capacityBlocked(event, "own")).toBe(false);
  });
  it("blocks every new or restored signup when the total is full", () => {
    for (const role of ["ride", "driver", "own"] as const) {
      expect(capacityBlocked({ ...event, signup_count: 3 }, role)).toBe(true);
      expect(
        capacityBlocked({ ...event, signup_count: 3 }, role, {
          role,
          cancelled: true,
        }),
      ).toBe(true);
    }
  });
  it("preserves existing places and permits changes that do not increase full counts", () => {
    const reduced = { ...event, signup_cap_total: 0, signup_cap_driver: 0 };
    const driver = { role: "driver", cancelled: false } as const;
    expect(capacityBlocked(reduced, "driver", driver)).toBe(false);
    expect(capacityBlocked(reduced, "ride", driver)).toBe(false);
    expect(
      capacityBlocked({ ...reduced, signup_cap_ride: 1 }, "ride", driver),
    ).toBe(true);
  });
  it("distinguishes zero from unlimited", () => {
    expect(capacityBlocked({ ...event, signup_cap_own: 0 }, "own")).toBe(true);
    expect(capacityBlocked({ ...event, signup_cap_total: null }, "own")).toBe(
      false,
    );
  });
});
