import { describe, expect, it } from "vitest";

import { SERVICE_NAMES } from "./index.js";

describe("service contracts", () => {
  it("names each independent runtime", () => {
    expect(Object.values(SERVICE_NAMES)).toEqual(["api", "web", "worker"]);
  });
});
