import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { useLocation, useSearchParams } from "react-router";
import { pacificDate, useAPI } from "./api";
import type { Quarter, Schema } from "./api";

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
}>({ quarters: [], loading: true, invalid: false, eventContext: false, select: () => {} });

export function Providers({ children }: { children: ReactNode }) {
  const identity = useAPI("SessionView", "/api/session");
  const quarters = useAPI("Page_QuarterPublic_", "/api/quarters?limit=200");
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const match = location.pathname.match(
    /^(\/admin)?\/events\/[^/]+\/(\d+)(?:\/.*)?$/,
  );
  const event = useAPI(
    match?.[1] ? "EventPrivate" : "EventPublic",
    `/api${match?.[1] ? "/admin" : ""}/events/${match?.[2]}`,
    { enabled: !!match && (!match[1] || !!identity.data?.officer) },
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
        session: identity.data,
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
