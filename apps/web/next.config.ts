import { resolve } from "node:path";

import type { NextConfig } from "next";

const sourceRevision = process.env.SOURCE_REVISION;
const backendInternalUrl = new URL(process.env.BACKEND_INTERNAL_URL ?? "http://127.0.0.1:3001");

if (!["http:", "https:"].includes(backendInternalUrl.protocol)) {
  throw new Error("BACKEND_INTERNAL_URL must use http or https.");
}

const nextConfig: NextConfig = {
  ...(sourceRevision
    ? { deploymentId: sourceRevision, generateBuildId: async () => sourceRevision }
    : {}),
  output: "standalone",
  outputFileTracingRoot: resolve(import.meta.dirname, "../.."),
  poweredByHeader: false,
  rewrites: async () => [
    {
      source: "/api/:path*",
      destination: `${backendInternalUrl.origin}/:path*`,
    },
  ],
  transpilePackages: ["@pickflick/ui"],
};

export default nextConfig;
