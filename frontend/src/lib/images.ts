import versions from "../../../assets/static-asset-versions.json";

export function staticAssetURL(url: string) {
  const [pathname] = url.split("?");
  const version = (versions as Record<string, string>)[pathname];
  return version ? `${pathname}?v=${version}` : url;
}

// The CSS gives most polaroids a 230–260px image slot. A phone's first hero
// photo is wider; the shared value also matches its server-side preload.
export const heroImageSizes =
  "(max-width: 639px) 256px, (max-width: 767px) 210px, 238px";
export const polaroidImageSizes = "(max-width: 767px) 246px, 238px";

export function imageSources(url: string) {
  const [pathname] = url.split("?");
  const media = pathname.match(
    /^\/media\/([a-f0-9]{32})\/(small|medium|large)$/,
  );
  if (media) {
    return {
      src: url,
      srcSet: [
        ["small", 320],
        ["medium", 640],
        ["large", 1280],
      ]
        .map(([variant, width]) => `/media/${media[1]}/${variant} ${width}w`)
        .join(", "),
    };
  }
  if (
    pathname.startsWith("/images/") &&
    !pathname.startsWith("/images/responsive/") &&
    pathname.endsWith(".webp")
  ) {
    return {
      src: staticAssetURL(pathname),
      srcSet: [320, 640, 800]
        .map(
          (width) =>
            `${staticAssetURL(pathname.replace("/images/", "/images/responsive/").replace(".webp", `-${width}.webp`))} ${width}w`,
        )
        .join(", "),
    };
  }
  return { src: staticAssetURL(url), srcSet: undefined };
}
