import { resolve } from "node:path";

import type { NextConfig } from "next";

const sourceRevision = process.env.SOURCE_REVISION;

const nextConfig: NextConfig = {
  ...(sourceRevision
    ? { deploymentId: sourceRevision, generateBuildId: async () => sourceRevision }
    : {}),
  output: "standalone",
  outputFileTracingRoot: resolve(import.meta.dirname, "../.."),
  poweredByHeader: false,
  transpilePackages: ["@pickflick/ui"],
};

export default nextConfig;
