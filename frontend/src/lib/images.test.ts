import { expect, it } from "vitest";
import { imageSources, staticAssetURL } from "./images";
import versions from "../../../assets/static-asset-versions.json";

it("versions each static image variant by its own content", () => {
  const sources = imageSources("/images/griffith_park.webp");
  expect(sources.src).toBe(
    `/images/griffith_park.webp?v=${versions["/images/griffith_park.webp"]}`,
  );
  for (const width of [320, 640, 800]) {
    const url = `/images/responsive/griffith_park-${width}.webp`;
    expect(sources.srcSet).toContain(`${staticAssetURL(url)} ${width}w`);
  }
});

it("offers all published media variants without changing their cache URL", () => {
  const id = "a".repeat(32);
  expect(imageSources(`/media/${id}/medium`)).toEqual({
    src: `/media/${id}/medium`,
    srcSet: `/media/${id}/small 320w, /media/${id}/medium 640w, /media/${id}/large 1280w`,
  });
});

it("preserves authenticated media preview URLs and external URLs", () => {
  for (const url of [
    "/api/admin/media/abc?variant=medium",
    "https://example.com/photo.webp",
  ]) {
    expect(imageSources(url)).toEqual({ src: url, srcSet: undefined });
  }
});

it("does not construct another variant of an already responsive static image", () => {
  const url = "/images/responsive/griffith_park-320.webp";
  expect(imageSources(url)).toEqual({
    src: staticAssetURL(url),
    srcSet: undefined,
  });
});
