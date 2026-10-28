import { useQueryClient } from "@tanstack/react-query";
import { canVisit } from "./access";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useSearchParams } from "react-router";
import { pacificDate, useAPI } from "./api";
import type { Quarter, Schema } from "./api";
import { useKeyboardViewport } from "./viewport";

const Identity = createContext<{
  session?: Schema<"SessionView">;
  loading: boolean;
  error: Error | null;
}>({ loading: true, error: null });
const Quarters = createContext<{
  quarters: Quarter[];
  quarter?: Quarter;
  loading: boolean;
  invalid: boolean;
  eventContext: boolean;
  select: (id: string) => void;
}>({
  quarters: [],
  loading: true,
  invalid: false,
  eventContext: false,
  select: () => {},
});

export function Providers({ children }: { children: ReactNode }) {
  useKeyboardViewport();
  const cache = useQueryClient();
  const identity = useAPI("SessionView", "/api/session");
  const [, tick] = useState(0);
  const rawSession = identity.data;
  const expiresAt = rawSession?.officer_access?.expires_at;
  const serverNow = rawSession
    ? new Date(rawSession.server_time).getTime() +
      Date.now() -
      identity.dataUpdatedAt
    : 0;
  const session =
    expiresAt && new Date(expiresAt).getTime() <= serverNow
      ? {
          ...rawSession!,
          officer_access: {
            kind: "none" as const,
            permissions: [],
            expires_at: null,
          },
        }
      : rawSession;
  const accessSignature = JSON.stringify([
    session?.member?.id,
    session?.officer,
    session?.officer_access,
  ]);
  const previousAccess = useRef<string | undefined>(undefined);
  const identityRef = useRef(identity.refetch);
  identityRef.current = identity.refetch;
  useEffect(() => {
    const refresh = () => {
      void identityRef.current();
    };
    window.addEventListener("aac-access-rejected", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("aac-access-rejected", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  useEffect(() => {
    if (!session) return;
    const signature = accessSignature;
    if (previousAccess.current && previousAccess.current !== signature) {
      const admin = {
        predicate: (q: { queryKey: readonly unknown[] }) =>
          q.queryKey.some(
            (v) => typeof v === "string" && v.startsWith("/api/admin/"),
          ),
      };
      // Reset clears sensitive data and refetches only observers still mounted
      // after the route guards apply the new permissions.
      void cache.cancelQueries(admin).then(() => cache.resetQueries(admin));
    }
    previousAccess.current = signature;
  }, [accessSignature, cache]);
  useEffect(() => {
    const expiry = identity.data?.officer_access?.expires_at;
    if (!expiry) return;
    const delay = Math.max(
      0,
      new Date(expiry).getTime() -
        new Date(identity.data!.server_time).getTime() -
        (Date.now() - identity.dataUpdatedAt),
    );
    const timer = window.setTimeout(
      () => {
        tick((n) => n + 1);
        void identityRef.current();
      },
      Math.min(delay + 100, 2147483647),
    );
    return () => window.clearTimeout(timer);
  }, [identity.data, identity.dataUpdatedAt]);
  const quarters = useAPI("Page_QuarterPublic_", "/api/quarters?limit=200");
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  useEffect(() => {
    if (!location.pathname.startsWith("/admin")) return;
    const timer = window.setInterval(() => {
      void identityRef.current();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [location.pathname]);
  const match = location.pathname.match(
    /^(\/admin)?\/events\/[^/]+\/(\d+)(?:\/.*)?$/,
  );
  const event = useAPI(
    match?.[1] ? "EventPrivate" : "EventPublic",
    `/api${match?.[1] ? "/admin" : ""}/events/${match?.[2]}`,
    { enabled: !!match && (!match[1] || canVisit(session, location.pathname)) },
  );
  const all = quarters.data?.items || [];
  const requested = event.data?.quarter_id
    ? String(event.data.quarter_id)
    : params.get("quarter");
  const today = pacificDate();
  const selected = requested
    ? all.find((q) => String(q.id) === requested)
    : all.find((q) => q.starts_on <= today && q.ends_on >= today) ||
      [...all]
        .filter((q) => q.starts_on > today)
        .sort((a, b) => a.starts_on.localeCompare(b.starts_on))[0] ||
      all[0];
  function select(id: string) {
    const next = new URLSearchParams(params);
    next.set("quarter", id);
    setParams(next);
  }
  return (
    <Identity.Provider
      value={{
        session,
        loading: identity.isPending,
        error: identity.error,
      }}
    >
      <Quarters.Provider
        value={{
          quarters: all,
          quarter: selected,
          loading: quarters.isPending,
          invalid: !!requested && !selected && !!quarters.data,
          eventContext: !!match,
          select,
        }}
      >
        {children}
      </Quarters.Provider>
    </Identity.Provider>
  );
}
export function useIdentity() {
  return useContext(Identity);
}
export function useQuarter() {
  return useContext(Quarters);
}
export function quarterURL(path: string, id?: number) {
  if (!id) return path;
  const url = new URL(path, "https://aac.invalid");
  url.searchParams.set("quarter", String(id));
  return url.pathname + url.search;
}
