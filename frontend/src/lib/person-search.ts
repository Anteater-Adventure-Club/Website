import distance from "talisman/metrics/damerau-levenshtein";
import { doubleMetaphone } from "double-metaphone";
import assign from "munkres-js";

type Person = { name: string; email?: string | null; phone?: string | null };
type Match = [tier: number, similarity: number];

export function normalizeName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const phoneticCache = new Map<string, string[]>();
function phonetics(token: string): string[] {
  if (token.length < 4 || !/^[a-z]+$/.test(token)) return [];
  const cached = phoneticCache.get(token);
  if (cached) return cached;
  const codes = new Set(doubleMetaphone(token).filter(Boolean));
  if (["sean", "shawn", "shaun"].includes(token)) codes.add("XN");
  const result = [...codes];
  if (phoneticCache.size >= 4096)
    phoneticCache.delete(phoneticCache.keys().next().value!);
  phoneticCache.set(token, result);
  return result;
}

function tokenMatch(query: string, token: string): Match | null {
  if (query === token) return [1, 1];
  const q = Array.from(query),
    t = Array.from(token);
  if (token.startsWith(query)) return [2, q.length / t.length];
  if (token.includes(query)) return [3, q.length / t.length];
  if (q.length < 3) return null;
  const maximum = q.length <= 7 ? 2 : 3;
  const threshold = q.length === 3 ? 2 / 3 : 0.7;
  const prefixes = new Set([token]);
  for (
    let n = Math.max(1, q.length - maximum);
    n <= Math.min(t.length, q.length + maximum);
    n++
  )
    prefixes.add(t.slice(0, n).join(""));
  let best = 0;
  for (const prefix of prefixes) {
    const p = Array.from(prefix),
      edits = distance(q, p);
    if (edits <= maximum)
      best = Math.max(best, 1 - edits / Math.max(q.length, p.length));
  }
  if (best + 1e-12 >= threshold) return [4, best];
  const similarity = 1 - distance(q, t) / Math.max(q.length, t.length);
  if (
    similarity >= 0.6 &&
    phonetics(query).some((code) => phonetics(token).includes(code))
  )
    return [5, similarity];
  return null;
}

function compareMatch(a: Match, b: Match): number {
  return a[0] - b[0] || b[1] - a[1];
}

function nameMatch(query: string, name: string): Match | null {
  if (!query || !name) return null;
  if (query === name) return [0, 1];
  const parts = query.split(" "),
    tokens = name.split(" ");
  if (parts.length > tokens.length) return null;
  const matches = parts.map((part) =>
    tokens.map((token) => tokenMatch(part, token)),
  );
  if (matches.some((row) => !row.some(Boolean))) return null;
  if (parts.length === 1)
    return matches[0]
      .filter((m): m is Match => m !== null)
      .sort(compareMatch)[0];
  const firstTier = Math.max(
    ...matches.map((row) =>
      Math.min(...row.filter((m): m is Match => m !== null).map((m) => m[0])),
    ),
  );
  for (let tier = firstTier; tier < 6; tier++) {
    const costs = matches.map((row) =>
      row.map((m) =>
        m && m[0] <= tier ? Math.round((1 - m[1]) * 1_000_000) : 1_000_000_000,
      ),
    );
    const selected = assign(costs).map(([i, j]) => matches[i][j]);
    if (
      selected.length === parts.length &&
      selected.every((m): m is Match => m !== null && m[0] <= tier)
    )
      return [tier, selected.reduce((sum, m) => sum + m[1], 0) / parts.length];
  }
  return null;
}

// Code-point order gives the same stable tie break as Python, including Unicode names.
function compareName(a: string, b: string): number {
  const ac = Array.from(a),
    bc = Array.from(b);
  for (let i = 0; i < Math.min(ac.length, bc.length); i++) {
    const delta = ac[i].codePointAt(0)! - bc[i].codePointAt(0)!;
    if (delta) return delta;
  }
  return ac.length - bc.length;
}

export function rankPeople<T extends Person>(
  people: readonly T[],
  search: string,
  id: (person: T) => number,
): T[] {
  const literal = Array.from(search.trim())
    .slice(0, 100)
    .join("")
    .toLowerCase();
  if (!literal) return [...people];
  const query = normalizeName(literal),
    digits = literal.replace(/\D/g, "");
  const phoneQuery = !!digits && /^[\d\s()+.\-]+$/.test(literal);
  const contactQuery = literal.includes("@") || phoneQuery;
  const ranked: { person: T; name: string; match: Match }[] = [];
  for (const person of people) {
    const name = normalizeName(person.name);
    let match = contactQuery ? null : nameMatch(query, name);
    const email = (person.email || "").toLowerCase(),
      phone = person.phone || "";
    for (const [value, needle] of [
      [email, literal],
      [phone, literal],
      [phone.replace(/\D/g, ""), phoneQuery ? digits : ""],
    ]) {
      if (needle && value && value.includes(needle)) {
        const contact: Match = [
          needle === value ? 0 : 3,
          Array.from(needle).length / Array.from(value).length,
        ];
        if (!match || compareMatch(contact, match) < 0) match = contact;
      }
    }
    if (match) ranked.push({ person, name, match });
  }
  return ranked
    .sort(
      (a, b) =>
        a.match[0] - b.match[0] ||
        Math.round(b.match[1] * 1e12) - Math.round(a.match[1] * 1e12) ||
        compareName(a.name, b.name) ||
        id(a.person) - id(b.person),
    )
    .map((row) => row.person);
}
