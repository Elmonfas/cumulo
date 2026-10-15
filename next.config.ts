import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

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
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
