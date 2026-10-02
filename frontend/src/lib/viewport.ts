import { useEffect } from "react";

/** Keep sheets and field tools inside the area above a phone keyboard. */
export function useKeyboardViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    let frame = 0;
    let ensureFocus = false;
    function update(event?: Event) {
      ensureFocus ||= event?.type !== "scroll";
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const maintainFocus = ensureFocus;
        ensureFocus = false;
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
        const active = document.activeElement;
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
        if (!mobile || !editable || !maintainFocus) return;
        const box = active.getBoundingClientRect();
        if (box.top >= top + 12 && box.bottom <= top + height - 64) return;
        active.scrollIntoView({ block: "center", behavior: "instant" });
        const centered = active.getBoundingClientRect();
        if (centered.top < top + 12 || centered.bottom > top + height - 64)
          window.scrollBy({
            top: centered.top + centered.height / 2 - top - height / 2,
            behavior: "instant",
          });
      });
    }
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update);
    document.addEventListener("focusin", update);
    document.addEventListener("input", update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("input", update);
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
