/** Content versions let browsers cache static assets without hiding updates. */
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const publicRoot = path.join(root, "frontend/public");
const versions = {};
async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) await visit(filename);
    else if (/\.(webp|svg|png|woff2)$/.test(entry.name)) {
      const url =
        "/" + path.relative(publicRoot, filename).split(path.sep).join("/");
      versions[url] = createHash("sha256")
        .update(await readFile(filename))
        .digest("hex")
        .slice(0, 12);
    }
  }
}
for (const directory of ["images", "logos", "fonts"])
  await visit(path.join(publicRoot, directory));
const output =
  JSON.stringify(Object.fromEntries(Object.entries(versions).sort()), null, 2) +
  "\n";
const filename = path.join(root, "assets/static-asset-versions.json");
if (process.argv.includes("--check")) {
  if ((await readFile(filename, "utf8")) !== output) {
    throw new Error(
      "Static asset versions are out of date. Run npm run assets:manifest.",
    );
  }
} else await writeFile(filename, output);
