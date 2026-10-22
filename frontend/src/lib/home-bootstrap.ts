import type { Schema } from "./api";

/** Consume the public SSI payload once; Vite and failed SSI use the API. */
export function readHomeBootstrap(
  document: Document,
): Schema<"HomeView"> | undefined {
  const node = document.getElementById("aac-home-data");
  if (!node) return;
  node.remove();
  try {
    const data = JSON.parse(node.textContent || "");
    if (
      data &&
      Array.isArray(data.upcoming) &&
      Array.isArray(data.polaroids) &&
      data.upcoming.every(
        (row: Schema<"EventPublic">) =>
          validDates(row) &&
          typeof row.id === "number" &&
          typeof row.name === "string" &&
          typeof row.slug === "string",
      ) &&
      data.polaroids.every(
        (row: Schema<"GalleryRow">) =>
          validDates(row) &&
          typeof row.event_id === "number" &&
          typeof row.event_name === "string" &&
          (row.image_id === null || typeof row.image_id === "string"),
      )
    ) {
      return data;
    }
  } catch {
    // Loading through the public API remains available when data is malformed.
  }
}

function validDates(row: Schema<"GalleryRow"> | Schema<"EventPublic">) {
  return (
    row &&
    typeof row.starts_at === "string" &&
    Number.isFinite(Date.parse(row.starts_at)) &&
    typeof row.ends_at === "string" &&
    Number.isFinite(Date.parse(row.ends_at))
  );
}
