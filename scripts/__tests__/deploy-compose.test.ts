import { describe, expect, it } from "vitest";

import { deployCompose } from "../deploy-compose.mjs";

describe("deployment convergence", () => {
  it("runs the release gate before converging application services", () => {
    const commands: string[][] = [];

    deployCompose((arguments_) => commands.push(arguments_));

    expect(commands).toEqual([
      ["compose", "-f", "compose.deploy.yaml", "--profile", "release", "run", "--rm", "release"],
      ["compose", "-f", "compose.deploy.yaml", "--profile", "application", "up", "-d", "--wait"],
    ]);
  });

  it("does not converge application services when the release gate fails", () => {
    const commands: string[][] = [];

    expect(() =>
      deployCompose((arguments_) => {
        commands.push(arguments_);
        throw new Error("release failed");
      }),
    ).toThrow("release failed");
    expect(commands).toEqual([
      ["compose", "-f", "compose.deploy.yaml", "--profile", "release", "run", "--rm", "release"],
    ]);
  });
});
