import { useEffect } from "react";

/** Keep sheets and field tools inside the area above a phone keyboard. */
export function useKeyboardViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    let frame = 0;
    let focusTimer = 0;
    let height = viewport.height;
    let width = innerWidth;

    function revealFocus() {
      const active = document.activeElement;
      const mobile =
        innerWidth <= 767 || matchMedia("(pointer: coarse)").matches;
      const editable =
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLInputElement &&
          ![
            "checkbox",
            "radio",
            "file",
            "range",
            "color",
            "button",
            "submit",
          ].includes(active.type));
      if (!mobile || !editable || viewport!.scale !== 1) return;

      const sheet = active.closest("dialog[open]");
      const sheetBox = sheet?.getBoundingClientRect();
      const top = Math.max(viewport!.offsetTop, sheetBox?.top ?? 0) + 12;
      const bottom =
        Math.min(
          viewport!.offsetTop + viewport!.height,
          sheetBox?.bottom ?? Infinity,
        ) - 64;
      const box = active.getBoundingClientRect();
      // Safari keeps a multiline caret visible; moving an oversized textarea
      // on every input fights that native scrolling.
      if (box.height > bottom - top) return;
      const delta =
        box.top < top
          ? box.top - top
          : box.bottom > bottom
            ? box.bottom - bottom
            : 0;
      if (!delta) return;
      if (sheet) {
        // scrollIntoView also scrolls ancestors, including the page behind a
        // modal. Keep the adjustment inside the sheet to avoid viewport loops.
        sheet.scrollBy({ top: delta, behavior: "instant" });
      } else {
        active.scrollIntoView({ block: "nearest", behavior: "instant" });
        const revealed = active.getBoundingClientRect();
        const remaining =
          revealed.top < top
            ? revealed.top - top
            : revealed.bottom > bottom
              ? revealed.bottom - bottom
              : 0;
        if (remaining) window.scrollBy({ top: remaining, behavior: "instant" });
      }
    }

    function update(event?: Event) {
      // iOS emits resize events while panning, even without a size change.
      // Only a new focus or a changed viewport size needs a focus adjustment.
      const resized = height !== viewport!.height || width !== innerWidth;
      height = viewport!.height;
      width = innerWidth;
      if (resized || event?.type === "focusin") {
        clearTimeout(focusTimer);
        focusTimer = window.setTimeout(revealFocus, 120);
      }
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // Preserve ordinary browser pinch zoom rather than resizing its layout.
        if (viewport!.scale !== 1) return;
        const height = viewport!.height;
        const top = viewport!.offsetTop;
        root.style.setProperty("--visible-height", `${height}px`);
        root.style.setProperty("--visible-top", `${top}px`);
        root.style.setProperty(
          "--keyboard-bottom",
          `${Math.max(0, innerHeight - height - top)}px`,
        );
        const mobile =
          innerWidth <= 767 || matchMedia("(pointer: coarse)").matches;
        root.classList.toggle(
          "keyboard-open",
          mobile && innerHeight - height > 150,
        );
      });
    }
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update);
    document.addEventListener("focusin", update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(focusTimer);
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
      document.removeEventListener("focusin", update);
      root.classList.remove("keyboard-open");
      for (const name of [
        "--visible-height",
        "--visible-top",
        "--keyboard-bottom",
      ])
        root.style.removeProperty(name);
    };
  }, []);
}
