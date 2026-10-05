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
        handler(html) {
          return html.replace(
            /href="((?:\/fonts|\/logos)\/[^"?]+)(?:\?[^\"]*)?"/g,
            (_, url) => `href="${assetURL(url)}"`,
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
