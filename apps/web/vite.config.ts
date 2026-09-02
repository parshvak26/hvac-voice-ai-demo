import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function readPublicUrl(value: string | undefined, originOnly: boolean) {
  if (!value?.trim()) return undefined;
  const url = new URL(value.trim());
  const localHttp =
    url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !localHttp) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (originOnly && url.pathname !== "/")
  ) {
    throw new Error("A public Vite URL setting is invalid.");
  }
  return originOnly
    ? url.origin
    : url.toString().replace(/\/$/, "");
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const publicOrigin = readPublicUrl(env.VITE_PUBLIC_ORIGIN, false);
  const apiOrigin = readPublicUrl(env.VITE_DEMO_API_URL, true);
  const basePath = env.VITE_BASE_PATH || "/";
  if (!/^\/(?:[A-Za-z0-9._-]+\/)?$/.test(basePath)) {
    throw new Error("VITE_BASE_PATH must be / or one repository path.");
  }
  const socialPreviewPlugin = {
    name: "social-preview-metadata",
    transformIndexHtml(html: string) {
      const imageMetadata = publicOrigin
        ? `<meta property="og:image" content="${publicOrigin}/og.png" />\n    <meta name="twitter:image" content="${publicOrigin}/og.png" />`
        : "";
      const securityMetadata = mode === "production"
        ? `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self'; img-src 'self' data:; script-src 'self' https://challenges.cloudflare.com; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; frame-src https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com${apiOrigin ? ` ${apiOrigin}` : ""};" />`
        : "";

      return html
        .replace("<!-- social-preview-image -->", imageMetadata)
        .replace("<!-- security-metadata -->", securityMetadata);
    },
  };

  return {
    base: basePath,
    plugins: [react(), socialPreviewPlugin],
    build: {
      sourcemap: mode !== "production",
    },
  };
});
