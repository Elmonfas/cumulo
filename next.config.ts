import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

/**
 * Política de contenido. Todo se sirve desde el propio dominio: los precios y
 * logos pasan por /api, así que el navegador nunca habla con terceros.
 * - 'unsafe-inline' en scripts: Next inyecta scripts en línea para hidratar
 *   (y el del tema evita el parpadeo); sin nonces, es lo necesario.
 * - data:/blob: en imágenes: avatar (dataURL) y tarjetas para compartir.
 */
const isDev = process.env.NODE_ENV === "development";
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // Sin upgrade-insecure-requests: Vercel ya fuerza HTTPS con HSTS, y la
  // directiva rompería `next start` en http://localhost.
].join("; ");

// cacheComponents queda desactivado: la integración de Serwist con Turbopack
// sirve el service worker desde un Route Handler con `dynamic = "force-static"`,
// incompatible con Cache Components. La app lee sus datos de IndexedDB en el
// cliente, así que no se pierde nada.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=(), interest-cohort=()",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
