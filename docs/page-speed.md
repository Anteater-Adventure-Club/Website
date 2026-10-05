# Page-speed assets and verification

The production Nginx SSI response for `/` includes the existing public `HomeView` data and a responsive preload for its first published polaroid. React consumes the JSON before rendering and seeds the normal query cache. The public API remains the fallback when the payload is absent or malformed; its normal refresh behavior remains available. Published text is escaped before it enters the inert JSON script. Metadata for other routes does not carry homepage data.

Static photos, logos and WOFF2 fonts use content versions from `assets/static-asset-versions.json`. Nginx grants a year of immutable caching to versioned URLs and a day to unversioned URLs. Built JavaScript/CSS still use Vite's hashed filenames. Uploaded media keeps its existing private five-minute cache policy and publication checks.

After adding or changing photos, prepare responsive copies with `python scripts/prepare-static-images.py`. After changing the supplied fonts, run `python scripts/prepare-fonts.py` with `fonttools[brotli]` installed. This produces basic and extended Latin subsets while retaining the original full fonts. CSS partitions their Unicode coverage. The basic subset includes punctuation, middle dots, copyright, and currency symbols used by the homepage. Font generation preserves source timestamps for reproducible output.

Then run `npm run assets:manifest` from `frontend`. `npm run build` checks that the committed manifest matches the actual static files. Both production Dockerfiles include the same manifest.

The homepage's photo captions are ordinary text. Activity names are level-three headings under “What we do!”. Board profiles retain real headings. The shared polaroid component supports published media variants and static responsive photos; authenticated officer previews keep their existing URLs.

## Browser verification

`E2E_BASE_URL=http://localhost:8080 npm run test:e2e:speed` runs against a production Nginx preview with the isolated browser fixtures. It checks preload/render source agreement, a single hero download, bootstrap/API fallback, font requests, headings and axe accessibility, rotation/navigation, robots, caching, and the Cloudflare script policy in Chromium, Firefox and WebKit at phone and desktop sizes. The CI production-preview step runs it after the social metadata suite.

The synthetic Cloudflare policy test intercepts both the script and its same-origin reporting request. It sends no analytics to production. Actual beacon execution, performance samples, screenshots and deployment approval are recorded separately in the dated evidence report.
