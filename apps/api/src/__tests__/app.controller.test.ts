import { describe, expect, it } from "vitest";

import { AppController } from "../app.controller.js";

describe("AppController", () => {
  it("identifies the API scaffold", () => {
    expect(new AppController().status()).toEqual({ service: "api", status: "scaffold" });
  });
});
