import { createServer } from "vite";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { createState, respond } from "./fixtures.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const screenshots = resolve(root, "../design/guest-officer-access/screenshots");
const states = new Map();
const roles = [
  "events",
  "participation",
  "members",
  "reimbursements",
  "board",
  "combined",
  "full",
  "expired",
  "payments",
];
const client = await readFile(resolve(here, "preview.js"), "utf8");
const port = Number(process.env.DEMO_PORT || 5180);
const server = await createServer({
  root,
  server: { host: "127.0.0.1", port, strictPort: true, open: false },
  plugins: [
    {
      name: "local-guest-demo",
      transformIndexHtml: {
        order: "pre",
        handler: () => [
          { tag: "script", children: client, injectTo: "head-prepend" },
        ],
      },
      configureServer(server) {
        // Runs before Vite's API proxy. No demo requests reach a real backend.
        server.middlewares.use(async (req, res, next) => {
          const url = new URL(req.url, "http://localhost");
          const path = url.pathname;
          const send = (status, body, type = "application/json") => {
            res.writeHead(status, {
              "Content-Type": type,
              "Cache-Control": "no-store",
            });
            res.end(type === "application/json" ? JSON.stringify(body) : body);
          };
          try {
            if (path === "/demo" || path === "/demo/")
              return send(
                200,
                await readFile(resolve(here, "index.html")),
                "text/html",
              );
            if (/^\/demo\/screenshots\/[a-z-]+\.png$/.test(path))
              return send(
                200,
                await readFile(resolve(screenshots, path.split("/").pop())),
                "image/png",
              );
            if (path === "/api/page-metadata")
              return send(
                200,
                '<title>AAC · Guest officer preview</title><meta name="robots" content="noindex">',
                "text/html",
              );
            if (path.startsWith("/media/")) return send(404, {});
            if (!path.startsWith("/api/") && !path.startsWith("/demo/control"))
              return next();
            const role = String(req.headers["x-demo-role"] || "expired");
            if (!roles.includes(role))
              return send(400, { detail: { message: "Unknown demo role" } });
            const key = `${String(req.headers["x-demo-session"] || "default")}:${role}`;
            if (!states.has(key)) states.set(key, createState(role));
            const state = states.get(key);
            let raw = "";
            for await (const chunk of req) {
              raw += chunk;
              if (raw.length > 100000) return send(413, {});
            }
            const input = raw ? JSON.parse(raw) : {};
            if (path === "/demo/control") {
              if (input.action === "reset") states.set(key, createState(role));
              if (input.action === "expire")
                state.expiry = new Date(Date.now() - 1000).toISOString();
              if (input.action === "countdown")
                state.expiry = new Date(Date.now() + 10000).toISOString();
              if (input.action === "payments") state.closed = !state.closed;
              return send(200, { ok: true });
            }
            const result = respond(state, path, req.method, input);
            return send(result.status, result.body);
          } catch (error) {
            if (error.code === "ENOENT")
              return send(404, {
                detail: {
                  message: "Run demo:guests:capture to generate screenshots.",
                },
              });
            console.error(error);
            return send(500, {
              detail: { message: "Local demo request failed" },
            });
          }
        });
      },
    },
  ],
});
await server.listen();
console.log(`Guest officer demo: http://localhost:${port}/demo`);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await server.close();
    process.exit(0);
  });
