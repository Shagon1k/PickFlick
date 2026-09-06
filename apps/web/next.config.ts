import { resolve } from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.SOURCE_REVISION ? { deploymentId: process.env.SOURCE_REVISION } : {}),
  generateBuildId: async () => process.env.SOURCE_REVISION ?? "development",
  output: "standalone",
  outputFileTracingRoot: resolve(import.meta.dirname, "../.."),
  poweredByHeader: false,
  transpilePackages: ["@pickflick/ui"],
};

export default nextConfig;
