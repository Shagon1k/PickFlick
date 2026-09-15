import type { MetadataRoute } from "next";

import { CANONICAL_ORIGIN, INDEXABLE_PUBLIC_ROUTES } from "../indexing";

export default function sitemap(): MetadataRoute.Sitemap {
  return INDEXABLE_PUBLIC_ROUTES.map((path) => ({
    changeFrequency: path.startsWith("/legal/") ? "yearly" : "monthly",
    priority: path === "/" ? 1 : 0.7,
    url: new URL(path, CANONICAL_ORIGIN).toString(),
  }));
}
