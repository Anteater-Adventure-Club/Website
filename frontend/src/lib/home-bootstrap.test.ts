// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { readHomeBootstrap } from "./home-bootstrap";

afterEach(() => document.head.replaceChildren());

function payload(value: string) {
  const node = document.createElement("script");
  node.id = "aac-home-data";
  node.type = "application/json";
  node.textContent = value;
  document.head.append(node);
}

it("consumes the server payload once, retaining escaped published text", () => {
  payload(
    '{"upcoming":[],"polaroids":[{"event_id":1,"event_name":"Trail","image_id":null,"starts_at":"2026-10-01T00:00:00Z","ends_at":"2026-10-01T01:00:00Z","title":"\\u003c/script>"}]}',
  );
  expect(readHomeBootstrap(document)?.polaroids[0].title).toBe("</script>");
  expect(readHomeBootstrap(document)).toBeUndefined();
});

it.each([
  undefined,
  "invalid JSON",
  "null",
  "{}",
  '{"upcoming":{},"polaroids":[]}',
  '{"upcoming":[null],"polaroids":[]}',
  '{"upcoming":[],"polaroids":[{"starts_at":"invalid"}]}',
])("falls back to the API for absent or malformed data: %s", (value) => {
  if (value !== undefined) payload(value);
  expect(readHomeBootstrap(document)).toBeUndefined();
  expect(document.getElementById("aac-home-data")).toBeNull();
});
