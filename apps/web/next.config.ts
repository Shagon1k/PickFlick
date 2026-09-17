import { resolve } from "node:path";

import { loadRepositoryEnvironmentFile } from "@pickflick/config/environment";
import type { NextConfig } from "next";

import { NOINDEX_HEADER, NON_PUBLIC_INDEXING_BOUNDARIES } from "./src/indexing";

loadRepositoryEnvironmentFile();

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
  headers: async () =>
    NON_PUBLIC_INDEXING_BOUNDARIES.map(({ headerSource }) => ({
      headers: [NOINDEX_HEADER],
      source: headerSource,
    })),
  rewrites: async () => [
    {
      source: "/api/auth/:path*",
      destination: `${backendInternalUrl.origin}/api/auth/:path*`,
    },
    {
      source: "/api/:path*",
      destination: `${backendInternalUrl.origin}/:path*`,
    },
  ],
  transpilePackages: ["@pickflick/ui"],
};

export default nextConfig;
