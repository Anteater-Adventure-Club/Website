import { describe, expect, it } from "vitest";
import cases from "../../../backend/tests/fixtures/person-search.json";
import { rankPeople } from "./person-search";

describe("library-backed officer name search", () => {
  it.each(cases)("$label", ({ query, people, expected }) => {
    const original = people.map((person) => person.id);
    expect(
      rankPeople(people, query, (person) => person.id).map(
        (person) => person.id,
      ),
    ).toEqual(expected);
    expect(people.map((person) => person.id)).toEqual(original);
    expect(
      rankPeople([...people].reverse(), query, (person) => person.id).map(
        (person) => person.id,
      ),
    ).toEqual(query.trim() ? expected : [...expected].reverse());
  });
});
