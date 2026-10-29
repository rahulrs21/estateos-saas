import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Browser end-to-end tests (scripts/test-maps-e2e.mjs) build into an isolated
  // directory with their own extending tsconfig, so they never share output or
  // the dev lock with `npm run dev` and never rewrite the project tsconfig.
  ...(process.env.ESTATEOS_NEXT_DIST_DIR ? {distDir: process.env.ESTATEOS_NEXT_DIST_DIR} : {}),
  ...(process.env.ESTATEOS_TSCONFIG_PATH ? {typescript: {tsconfigPath: process.env.ESTATEOS_TSCONFIG_PATH}} : {}),
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
