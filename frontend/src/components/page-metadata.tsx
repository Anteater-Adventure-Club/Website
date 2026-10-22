import { useEffect } from "react";
import { useLocation } from "react-router";

const selector =
  'title, meta[name="description"], meta[property^="og:"], meta[name^="twitter:"], meta[name="robots"], meta[name="aac-page-path"], link[rel="canonical"]';

/** Keep browser navigation consistent with the metadata served to crawlers. */
export function PageMetadata() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (
      document.head
        .querySelector('meta[name="aac-page-path"]')
        ?.getAttribute("content") === pathname
    )
      return;
    const controller = new AbortController();
    async function update() {
      try {
        const response = await fetch("/api/page-metadata", {
          headers: { "X-AAC-Page-URI": pathname },
          signal: controller.signal,
        });
        if (!response.ok) return;
        const html = await response.text();
        if (controller.signal.aborted) return;
        const head = new DOMParser().parseFromString(html, "text/html").head;
        document.head
          .querySelectorAll(selector)
          .forEach((node) => node.remove());
        head
          .querySelectorAll(selector)
          .forEach((node) => document.head.appendChild(node));
      } catch {
        // The initial HTML already contains a title and metadata. Navigation
        // still works when a metadata request is interrupted or unavailable.
      }
    }
    void update();
    return () => controller.abort();
  }, [pathname]);
  return null;
}
