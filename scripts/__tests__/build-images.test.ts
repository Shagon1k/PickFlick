import { describe, expect, it } from "vitest";

import { sourceRevision } from "../build-images.mjs";

const headRevision = "a".repeat(40);

function gitWith({ head = headRevision, inside = true, status = "" } = {}) {
  return (arguments_: string[]) => {
    switch (arguments_.join(" ")) {
      case "rev-parse --is-inside-work-tree":
        return { status: inside ? 0 : 128, stdout: inside ? "true\n" : "" };
      case "status --porcelain":
        return { status: 0, stdout: status };
      case "rev-parse HEAD":
        return { status: 0, stdout: `${head}\n` };
      default:
        throw new Error(`Unexpected Git arguments: ${arguments_.join(" ")}`);
    }
  };
}

describe("production image source revision", () => {
  it("accepts a configured revision that matches a clean checkout", () => {
    expect(sourceRevision({ SOURCE_REVISION: headRevision }, gitWith())).toBe(headRevision);
  });

  it("rejects a configured revision that differs from Git HEAD", () => {
    expect(() => sourceRevision({ SOURCE_REVISION: "b".repeat(40) }, gitWith())).toThrow(
      /SOURCE_REVISION must match the checked-out Git HEAD/,
    );
  });

  it("rejects a dirty checkout even when a revision is configured", () => {
    expect(() => sourceRevision({ SOURCE_REVISION: headRevision }, gitWith({ status: " M Dockerfile\n" }))).toThrow(
      /dirty worktree/,
    );
  });

  it("uses the configured revision when Git metadata is unavailable", () => {
    expect(sourceRevision({ SOURCE_REVISION: headRevision }, gitWith({ inside: false }))).toBe(headRevision);
  });
});
