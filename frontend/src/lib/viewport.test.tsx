// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useKeyboardViewport } from "./viewport";

describe("phone keyboard focus", () => {
  let viewport: EventTarget;
  let height: number;
  let offset: number;

  beforeEach(() => {
    vi.useFakeTimers();
    height = 844;
    offset = 0;
    viewport = new EventTarget();
    Object.defineProperties(viewport, {
      height: { get: () => height },
      offsetTop: { get: () => offset },
      scale: { value: 1 },
    });
    vi.stubGlobal("visualViewport", viewport);
    vi.stubGlobal("innerWidth", 390);
    vi.stubGlobal("innerHeight", 844);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(0), 16),
    );
    vi.stubGlobal("cancelAnimationFrame", window.clearTimeout);
    vi.spyOn(window, "scrollBy").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function fieldInSheet() {
    const sheet = document.createElement("dialog");
    sheet.open = true;
    const input = document.createElement("input");
    sheet.append(input);
    document.body.append(sheet);
    vi.spyOn(sheet, "getBoundingClientRect").mockReturnValue({
      top: 120,
      bottom: 460,
      height: 340,
    } as DOMRect);
    vi.spyOn(input, "getBoundingClientRect").mockReturnValue({
      top: 430,
      bottom: 474,
      height: 44,
    } as DOMRect);
    input.scrollIntoView = vi.fn();
    sheet.scrollBy = vi.fn();
    return { sheet, input };
  }

  function settle() {
    act(() => vi.runAllTimers());
  }

  it("skips repeated style writes when viewport geometry is unchanged", () => {
    const writes = vi.spyOn(document.documentElement.style, "setProperty");
    renderHook(useKeyboardViewport);
    settle();
    expect(writes).toHaveBeenCalledTimes(3);
    writes.mockClear();
    viewport.dispatchEvent(new Event("resize"));
    viewport.dispatchEvent(new Event("scroll"));
    settle();
    expect(writes).not.toHaveBeenCalled();
    offset = 40;
    viewport.dispatchEvent(new Event("scroll"));
    settle();
    expect(writes).toHaveBeenCalledTimes(1);
    expect(writes).toHaveBeenCalledWith("--visible-top", "40px");
  });

  it("reveals an obscured field by scrolling its sheet without moving the page", () => {
    renderHook(useKeyboardViewport);
    const { sheet, input } = fieldInSheet();
    input.focus();
    height = 480;
    viewport.dispatchEvent(new Event("resize"));
    settle();
    expect(sheet.scrollBy).toHaveBeenCalled();
    expect(input.scrollIntoView).not.toHaveBeenCalled();
    expect(window.scrollBy).not.toHaveBeenCalled();
  });

  it("does not recenter on typing, viewport panning, or redundant iOS resize events", () => {
    renderHook(useKeyboardViewport);
    const { sheet, input } = fieldInSheet();
    input.focus();
    height = 480;
    viewport.dispatchEvent(new Event("resize"));
    settle();
    vi.mocked(sheet.scrollBy).mockClear();
    vi.mocked(input.scrollIntoView).mockClear();
    for (const letter of "Gabe") {
      input.value += letter;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      offset += 8;
      viewport.dispatchEvent(new Event("scroll"));
      viewport.dispatchEvent(new Event("resize"));
      settle();
    }
    expect(input.value).toBe("Gabe");
    expect(document.activeElement).toBe(input);
    expect(sheet.scrollBy).not.toHaveBeenCalled();
    expect(input.scrollIntoView).not.toHaveBeenCalled();
    expect(window.scrollBy).not.toHaveBeenCalled();
  });

  it("waits for the keyboard animation to settle before adjusting focus", () => {
    renderHook(useKeyboardViewport);
    const { sheet, input } = fieldInSheet();
    input.focus();
    for (const nextHeight of [700, 600, 480]) {
      height = nextHeight;
      viewport.dispatchEvent(new Event("resize"));
      act(() => vi.advanceTimersByTime(32));
    }
    expect(sheet.scrollBy).not.toHaveBeenCalled();
    settle();
    expect(sheet.scrollBy).toHaveBeenCalledTimes(1);
  });

  it("reserves a wrapped sticky footer and sheet padding when revealing a field", () => {
    renderHook(useKeyboardViewport);
    const { sheet, input } = fieldInSheet();
    sheet.style.paddingBottom = "24px";
    const actions = document.createElement("div");
    actions.className = "sticky-actions";
    sheet.append(actions);
    vi.spyOn(actions, "getBoundingClientRect").mockReturnValue({
      height: 108,
    } as DOMRect);
    input.focus();
    height = 480;
    viewport.dispatchEvent(new Event("resize"));
    settle();
    expect(sheet.scrollBy).toHaveBeenCalledWith({
      top: 158,
      behavior: "instant",
    });
    expect(window.scrollBy).not.toHaveBeenCalled();
  });
});
