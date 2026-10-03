import { useEffect, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Menu, LogOut } from "lucide-react";
import { request, useAPI } from "../lib/api";
import { quarterURL, useIdentity, useQuarter } from "../lib/context";
import { Button, Dialog, Empty, Failure, Loading, Pill } from "./ui";

const publicLinks = [
  ["/", "Home"],
  ["/events", "Events"],
  ["/board", "Board"],
  ["/membership", "Membership"],
];
const memberLinks = [
  ["/my-aac", "Overview"],
  ["/my-aac/signups", "My Signups"],
  ["/membership", "Membership"],
  ["/my-aac/profile", "Profile & Cars"],
  ["/my-aac/reimbursements", "Reimbursements"],
];
const adminLinks = [
  ["/admin/overview", "Dashboard"],
  ["/admin/events", "Events"],
  ["/admin/check-in", "Check In"],
  ["/admin/members", "Members"],
  ["/admin/reimbursements", "Reimbursements"],
  ["/admin/officers", "Officers"],
  ["/admin/settings", "Settings"],
];

export function Layout() {
  const { session } = useIdentity();
  const { quarter } = useQuarter();
  const [menu, setMenu] = useState(false);
  const [account, setAccount] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const accountToggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!account) return;
    function outside(event: PointerEvent) {
      if (!accountRef.current?.contains(event.target as Node))
        setAccount(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAccount(false);
        accountToggle.current?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [account]);
  const cache = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const membership = useAPI(
    "MembershipView",
    `/api/me/memberships/${quarter?.id}`,
    { enabled: !!session?.member && !!quarter },
  );
  const settings = useAPI("SiteSettings", "/api/site-settings");
  const nav = [
    ...publicLinks,
    ...(session?.member ? [["/my-aac", "My AAC"]] : []),
    ...(session?.officer ? [["/admin/overview", "Officer Tools"]] : []),
  ];
  async function logout() {
    await request("/api/auth/logout", "POST");
    cache.clear();
    setAccount(false);
    setMenu(false);
    navigate("/");
  }
  const initials = session?.member?.name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("");
  const accountContents = (
    <>
      <div className="account-info">
        <strong>{session?.member?.name}</strong>
        <small>{session?.member?.email}</small>
        <Pill>
          {membership.data?.status === "approved"
            ? "Paid Member"
            : "General Member"}
          {quarter && ` · ${quarter.name}`}
        </Pill>
      </div>
      {memberLinks.map(([url, label]) => (
        <Link
          key={url}
          to={quarterURL(url, quarter?.id)}
          onClick={() => {
            setAccount(false);
            setMenu(false);
          }}
        >
          {label}
        </Link>
      ))}
      {session?.officer && (
        <Link
          to={
            location.pathname.startsWith("/admin")
              ? "/my-aac"
              : "/admin/overview"
          }
          onClick={() => {
            setAccount(false);
            setMenu(false);
          }}
        >
          {location.pathname.startsWith("/admin")
            ? "Member View"
            : "Officer Tools"}
        </Link>
      )}
      <Button variant="quiet" onClick={logout}>
        <LogOut size={18} />
        Sign Out
      </Button>
    </>
  );
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <Link className="brand" to="/" aria-label="AAC Home">
          <img src="/logos/aac.svg?v=transparent" alt="" width="44" height="44" />
          <span>AAC</span>
        </Link>
        <Button
          className="mobile-menu"
          variant="quiet"
          aria-label="Open navigation"
          onClick={() => setMenu(true)}
        >
          <Menu />
        </Button>
        <nav aria-label="Main navigation" className="desktop-navigation">
          {nav.map(([url, label]) => (
            <NavLink end={url === "/" || url === "/my-aac"} key={url} to={url}>
              {label}
            </NavLink>
          ))}
        </nav>
        {session?.member ? (
          <div
            className="account"
            ref={accountRef}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget))
                setAccount(false);
            }}
          >
            <button
              ref={accountToggle}
              className="avatar"
              aria-label="Open account menu"
              aria-expanded={account}
              onClick={() => setAccount(!account)}
            >
              {initials}
            </button>
            {account && <div className="account-menu">{accountContents}</div>}
          </div>
        ) : (
          <Link
            className="button secondary small"
            to={`/sign-in?return_to=${encodeURIComponent(location.pathname + location.search)}`}
          >
            Sign In
          </Link>
        )}
      </header>
      {menu && (
        <Dialog title="Explore AAC" onClose={() => setMenu(false)}>
          <nav className="drawer-navigation" aria-label="Mobile navigation">
            {nav.map(([url, label]) => (
              <NavLink key={url} to={url} onClick={() => setMenu(false)}>
                {label}
              </NavLink>
            ))}
            {session?.member && accountContents}
          </nav>
        </Dialog>
      )}
      <main id="main">
        <Outlet />
      </main>
      <footer className="footer">
        <span>© {new Date().getFullYear()} Anteater Adventure Club</span>
        {settings.data?.discord && (
          <a href={settings.data.discord} target="_blank" rel="noreferrer">
            Discord
          </a>
        )}
        <a
          href="https://www.instagram.com/anteateradventureclub/"
          target="_blank"
          rel="noreferrer"
        >
          Instagram
        </a>
        <a
          href="https://github.com/Anteater-Adventure-Club/Website"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
      </footer>
    </>
  );
}

export function Guard({ officer = false }: { officer?: boolean }) {
  const { session, loading, error } = useIdentity();
  const location = useLocation();
  if (loading) return <Loading />;
  if (error) return <Failure error={error} />;
  if (!session?.member)
    return (
      <Navigate
        replace
        to={`/sign-in?return_to=${encodeURIComponent(location.pathname + location.search)}`}
      />
    );
  if (officer && !session.officer)
    return (
      <Empty
        title="Officers only"
        action={
          <Link className="button primary" to="/my-aac">
            Back to My AAC
          </Link>
        }
      >
        This area is for AAC officers. Your adventures are over in My AAC.
      </Empty>
    );
  return <Outlet />;
}

export function QuarterPicker() {
  const { quarters, quarter, select, eventContext } = useQuarter();
  return quarters.length && !eventContext ? (
    <label className="quarter-picker">
      <span className="sr-only">Selected quarter</span>
      <select
        value={quarter?.id || ""}
        onChange={(event) => select(event.target.value)}
      >
        {quarters.map((q) => (
          <option key={q.id} value={q.id}>
            {q.name}
            {q.state !== "open" ? ` · ${q.state}` : ""}
          </option>
        ))}
      </select>
    </label>
  ) : null;
}

export function Workspace({ admin = false }: { admin?: boolean }) {
  const { quarter, invalid } = useQuarter();
  const { session } = useIdentity();
  const links = admin ? adminLinks : memberLinks;
  const [sections, setSections] = useState(false);
  const location = useLocation();
  const selected =
    links.find(([url]) => location.pathname === url)?.[1] ||
    (admin ? "Officer Tools" : "My AAC");
  return (
    <>
      <div className="workspace-bar">
        <nav
          className="workspace-tabs"
          aria-label={admin ? "Officer sections" : "My AAC sections"}
        >
          {links.map(([url, label]) => (
            <NavLink end key={url} to={quarterURL(url, quarter?.id)}>
              {label}
            </NavLink>
          ))}
        </nav>
        <Button
          className="section-picker"
          variant="quiet"
          onClick={() => setSections(true)}
        >
          {selected} <Menu size={18} />
        </Button>
        <div className="workspace-controls">
          <QuarterPicker />
          {session?.officer && (
            <Link
              className="mode-switch"
              to={admin ? "/my-aac" : "/admin/overview"}
            >
              {admin ? "Member View" : "Officer Tools"}
            </Link>
          )}
        </div>
      </div>
      {sections && (
        <Dialog
          title={admin ? "Officer Tools" : "My AAC"}
          onClose={() => setSections(false)}
        >
          <nav className="drawer-navigation">
            {links.map(([url, label]) => (
              <Link
                key={url}
                to={quarterURL(url, quarter?.id)}
                onClick={() => setSections(false)}
              >
                {label}
              </Link>
            ))}
          </nav>
        </Dialog>
      )}
      <div className="page workspace-page">
        {invalid ? (
          <Empty title="Quarter not found">
            Choose an available quarter from the menu above.
          </Empty>
        ) : (
          <Outlet />
        )}
      </div>
    </>
  );
}
