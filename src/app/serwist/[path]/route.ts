import { createSerwistRoute } from "@serwist/turbopack";

// La revisión invalida la página offline precacheada en cada deploy.
const revision = process.env.VERCEL_GIT_COMMIT_SHA ?? crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
  swSrc: "src/app/sw.ts",
  // esbuild nativo también en Linux (Vercel): evita depender de esbuild-wasm.
  useNativeEsbuild: true,
});
