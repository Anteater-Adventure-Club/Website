import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import versions from "../assets/static-asset-versions.json";
const assetURL = (url: string) => {
  const version = (versions as Record<string, string>)[url];
  return version ? `${url}?v=${version}` : url;
};
export default defineConfig({
  plugins: [
    react(),
    {
      name: "version-static-assets",
      enforce: "pre",
      transformIndexHtml: {
        order: "post",
        handler(html, context) {
          return html
            .replace(
              /href="((?:\/fonts|\/logos)\/[^"?]+)(?:\?[^\"]*)?"/g,
              (_, url) => `href="${assetURL(url)}"`,
            )
            .replace(
              /<link\b[^>]*rel="stylesheet"[^>]*href="\/([^"?]+\.css)"[^>]*>/g,
              (tag, filename) => {
                const asset = context.bundle?.[filename];
                if (!asset || asset.type !== "asset") return tag;
                const css =
                  typeof asset.source === "string"
                    ? asset.source
                    : new TextDecoder().decode(asset.source);
                // The shared stylesheet is about 9 KiB compressed. Embedding
                // it removes a blocking round trip before React's first paint.
                return `<style data-aac-styles>${css.replace(/<\/style/gi, "<\\/style")}</style>`;
              },
            );
        },
      },
      transform(code, id) {
        if (!id.endsWith("styles.css")) return;
        return code.replace(
          /url\("(\/fonts\/[^"?]+)"\)/g,
          (_, url) => `url("${assetURL(url)}")`,
        );
      },
    },
  ],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8000",
      "/media": "http://127.0.0.1:8000",
    },
  },
  build: { sourcemap: false },
});
