import { describe, expect, it } from "vitest";
import { fromPacific, pacificInput } from "./api";
describe("Pacific form timestamps", () => {
  it.each(["2026-03-08T02:15", "2026-11-01T01:30"])(
    "rejects a DST-invalid or ambiguous local time: %s",
    (value) => expect(() => fromPacific(value)).toThrow(),
  );
  it.each([
    ["2026-01-15T09:30", "2026-01-15T17:30:00.000Z"],
    ["2026-07-15T09:30", "2026-07-15T16:30:00.000Z"],
    ["2026-11-01T02:30", "2026-11-01T10:30:00.000Z"],
  ])(
    "preserves Pacific wall time independently of browser zone: %s",
    (local, utc) => {
      expect(fromPacific(local)).toBe(utc);
      expect(pacificInput(utc)).toBe(local);
    },
  );
  it("preserves an optional blank operational window", () =>
    expect(fromPacific("")).toBeNull());
});
