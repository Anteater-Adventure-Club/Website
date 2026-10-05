import { useEffect, useState } from "react";

export function useSearchQuery(value: string): {
  query: string;
  pending: boolean;
} {
  const normalized = Array.from(value.trim()).slice(0, 100).join("");
  const [query, setQuery] = useState(normalized);
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(normalized), 150);
    return () => window.clearTimeout(timer);
  }, [normalized]);
  // Clear immediately so a previously found member cannot be selected accidentally.
  const current = normalized ? query : "";
  return { query: current, pending: normalized !== current };
}
