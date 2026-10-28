import { useEffect, useId, useRef, useState } from "react";
import type { PointerEvent, ReactNode, TouchEvent } from "react";
import { ArrowLeft, ArrowRight, Hand, MoveHorizontal } from "lucide-react";
import { Button } from "./ui";

const interactive =
  "a, button, input, select, textarea, summary, label, [contenteditable], [role='button']";

/** Mouse/pen dragging supplements native touch, trackpad, and keyboard scrolling. */
export function SwipeTable({
  children,
  toolbar,
}: {
  children: ReactNode;
  toolbar?: ReactNode;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    left: number;
    top: number;
    active: boolean;
  } | null>(null);
  const touching = useRef(false);
  const suppressClick = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [contact, setContact] = useState<{ x: number; y: number } | null>(null);
  const [scroll, setScroll] = useState({ left: 0, max: 0 });

  function measure() {
    const node = viewport.current;
    if (!node) return;
    const max = Math.max(0, node.scrollWidth - node.clientWidth);
    const left = Math.max(0, Math.min(node.scrollLeft, max));
    setScroll((old) =>
      old.left === left && old.max === max ? old : { left, max },
    );
  }
  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    if (node.firstElementChild) observer.observe(node.firstElementChild);
    measure();
    return () => observer.disconnect();
  }, [children]);

  function showContact(x: number, y: number) {
    const box = surface.current?.getBoundingClientRect();
    if (box) setContact({ x: x - box.left, y: y - box.top });
  }
  function canDrag(target: EventTarget | null) {
    const node = viewport.current;
    return (
      !!node &&
      matchMedia("(min-width: 768px)").matches &&
      (node.scrollWidth > node.clientWidth + 1 ||
        node.scrollHeight > node.clientHeight + 1) &&
      target instanceof Element &&
      target !== node &&
      !target.closest(interactive)
    );
  }
  function start(event: PointerEvent<HTMLDivElement>) {
    suppressClick.current = false;
    if (
      event.pointerType === "touch" ||
      !event.isPrimary ||
      event.button !== 0 ||
      event.shiftKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.detail > 1 ||
      !canDrag(event.target)
    )
      return;
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: event.currentTarget.scrollLeft,
      top: event.currentTarget.scrollTop,
      active: false,
    };
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (!current.active && Math.hypot(dx, dy) < 6) return;
    if (!current.active) {
      current.active = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.focus({ preventScroll: true });
      window.getSelection()?.removeAllRanges();
      setDragging(true);
    }
    event.preventDefault();
    event.currentTarget.scrollLeft = current.left - dx;
    event.currentTarget.scrollTop = current.top - dy;
    showContact(event.clientX, event.clientY);
  }
  function finish(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    suppressClick.current = current.active;
    drag.current = null;
    setDragging(false);
    setContact(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function touch(event: TouchEvent<HTMLDivElement>, starting: boolean) {
    if (starting)
      touching.current = event.touches.length === 1 && canDrag(event.target);
    if (event.touches.length !== 1) touching.current = false;
    if (touching.current)
      showContact(event.touches[0].clientX, event.touches[0].clientY);
    else setContact(null);
    // Let the browser handle native panning, momentum, and pinch zoom.
  }
  function nudge(direction: number) {
    const node = viewport.current;
    node?.scrollBy({
      left: direction * Math.min(540, Math.max(270, node.clientWidth - 220)),
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }

  return (
    <div className="swipe-table">
      {(toolbar || scroll.max > 1) && (
        <div className="swipe-table-toolbar">
          {toolbar}
          {scroll.max > 1 && (
            <div className="swipe-table-controls">
              <p id={hintId} className="swipe-table-hint">
                <span className="swipe-gesture" aria-hidden="true">
                  <MoveHorizontal size={34} />
                  <Hand size={22} />
                </span>
                <span>
                  <strong>Swipe or drag across answers</strong>
                  <small>Member names stay in view.</small>
                </span>
              </p>
              <div className="actions">
                <Button
                  type="button"
                  variant="secondary"
                  aria-label="Scroll responses left"
                  title="Scroll responses left"
                  disabled={scroll.left <= 1}
                  onClick={() => nudge(-1)}
                >
                  <ArrowLeft size={20} />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  aria-label="Scroll responses right"
                  title="Scroll responses right"
                  disabled={scroll.left >= scroll.max - 1}
                  onClick={() => nudge(1)}
                >
                  <ArrowRight size={20} />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="swipe-table-surface" ref={surface}>
        <div
          ref={viewport}
          className={`table-wrapper response-grid-wrapper${scroll.max > 1 ? " can-swipe" : ""}${dragging ? " is-dragging" : ""}`}
          role="region"
          aria-label="Form responses"
          aria-describedby={scroll.max > 1 ? hintId : undefined}
          title="Drag to scroll. Hold Shift while dragging to select text."
          tabIndex={0}
          onScroll={measure}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={finish}
          onPointerCancel={finish}
          onLostPointerCapture={finish}
          onPointerLeave={() => {
            if (drag.current && !drag.current.active) drag.current = null;
          }}
          onTouchStart={(event) => touch(event, true)}
          onTouchMove={(event) => touch(event, false)}
          onTouchEnd={() => {
            touching.current = false;
            setContact(null);
          }}
          onTouchCancel={() => {
            touching.current = false;
            setContact(null);
          }}
          onClickCapture={(event) => {
            if (suppressClick.current) {
              suppressClick.current = false;
              event.preventDefault();
              event.stopPropagation();
            }
          }}
        >
          {children}
        </div>
        {contact && (
          <span
            className="swipe-contact"
            aria-hidden="true"
            style={{ left: contact.x, top: contact.y }}
          />
        )}
      </div>
    </div>
  );
}
