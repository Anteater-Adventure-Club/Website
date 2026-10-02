import { useEffect, useId, useRef } from "react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";
import { Link } from "react-router";
import { ArrowRight, CalendarDays, X } from "lucide-react";
import { ApiError, dateLabel, eventURL, photoURL } from "../lib/api";
import type { Event } from "../lib/api";

export function Button({
  children,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet" | "danger";
}) {
  return (
    <button {...props} className={`button ${variant} ${props.className || ""}`}>
      {children}
    </button>
  );
}
export function Pill({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`pill ${tone}`}>{children}</span>;
}
export function Field({
  label,
  hint,
  children,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  children?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children ? <div id={id}>{children}</div> : <input {...props} id={id} />}
      {hint && <small>{hint}</small>}
    </div>
  );
}
export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`panel ${className}`}>{children}</section>;
}
export function PageHeading({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="actions">{children}</div>}
    </div>
  );
}
export function Message({
  error,
  children,
}: {
  error?: Error | null;
  children?: ReactNode;
}) {
  if (!error && !children) return null;
  return (
    <div
      className={`notice ${error ? "error" : ""}`}
      role={error ? "alert" : "status"}
    >
      {error?.message || children}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status" aria-label="Loading">
      <div className="skeleton title" />
      <div className="skeleton block" />
      <span className="sr-only">Loading AAC…</span>
    </div>
  );
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Panel className="empty">
      <CalendarDays size={32} aria-hidden="true" />
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </Panel>
  );
}
export function Failure({
  error,
  retry,
}: {
  error: Error;
  retry?: () => unknown;
}) {
  const denied = error instanceof ApiError && error.status === 403;
  return (
    <Empty
      title={denied ? "Officers only" : "A little detour"}
      action={retry && <Button onClick={retry}>Try again</Button>}
    >
      {denied
        ? "You can still explore events and your member pages."
        : error.message}
    </Empty>
  );
}
export function Dialog({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "wide" : ""}
      aria-labelledby={id}
      onCancel={onClose}
      onKeyDown={(event) => {
        if (
          event.key !== "Tab" ||
          (event.target as Element).closest("dialog") !== event.currentTarget
        )
          return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:enabled, a[href], input:enabled, select:enabled, textarea:enabled, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter(
          (control) =>
            control.offsetParent !== null &&
            control.closest("dialog") === event.currentTarget,
        );
        const first = controls[0],
          last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onClick={(event) => {
        if (event.target === ref.current) {
          const box = ref.current.getBoundingClientRect();
          if (
            event.clientX < box.left ||
            event.clientX > box.right ||
            event.clientY < box.top ||
            event.clientY > box.bottom
          )
            onClose();
        }
      }}
    >
      <div className="dialog-heading">
        <h2 id={id}>{title}</h2>
        <Button variant="quiet" aria-label="Close dialog" onClick={onClose}>
          <X />
        </Button>
      </div>
      {children}
    </dialog>
  );
}
export function EventCard({
  event,
  admin = false,
}: {
  event: Event;
  admin?: boolean;
}) {
  return (
    <Link className="event-card panel" to={eventURL(event, admin)}>
      <span className={`date-tile ${event.kind}`}>
        <small>{dateLabel(event.starts_at, { month: "short" })}</small>
        <strong>{dateLabel(event.starts_at, { day: "numeric" })}</strong>
      </span>
      <div>
        <h3>{event.name}</h3>
        <p>
          {dateLabel(event.starts_at)} ·{" "}
          {event.destination || "Adventure awaits"}
        </p>
        <Pill tone={event.state === "cancelled" ? "orange" : "green"}>
          {event.state === "cancelled"
            ? "Cancelled"
            : event.signup_status === "open"
              ? "Signups open"
              : event.kind === "meeting"
                ? "Club meeting"
                : event.state === "completed"
                  ? "Completed"
                  : "Upcoming"}
        </Pill>
      </div>
      <ArrowRight className="card-arrow" size={18} aria-hidden="true" />
    </Link>
  );
}
export function Polaroid({
  image,
  title,
  caption,
  onClick,
  rotation = 0,
}: {
  image?: string;
  title: string;
  caption?: string;
  onClick?: () => void;
  rotation?: number;
}) {
  const content = (
    <>
      <img
        src={image || photoURL(null)}
        alt=""
        loading="lazy"
        width={640}
        height={480}
      />
      <h3>{title}</h3>
      {caption && <p>{caption}</p>}
    </>
  );
  return onClick ? (
    <button
      className="polaroid"
      style={{ transform: `rotate(${rotation}deg)` }}
      onClick={onClick}
    >
      {content}
    </button>
  ) : (
    <div className="polaroid" style={{ transform: `rotate(${rotation}deg)` }}>
      {content}
    </div>
  );
}
