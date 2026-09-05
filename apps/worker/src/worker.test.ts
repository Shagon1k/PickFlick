import { describe, expect, it, vi } from "vitest";

import { runWorker, workerStatus } from "./worker.js";

describe("worker scaffold", () => {
  it("starts and stops through an abort signal", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const controller = new AbortController();
    const running = runWorker(controller.signal);

    controller.abort();

    await expect(running).resolves.toBeUndefined();
    expect(workerStatus).toEqual({ service: "worker", status: "scaffold" });
    log.mockRestore();
  });
});
