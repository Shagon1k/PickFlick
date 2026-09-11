import { describe, expect, it } from "vitest";

import { deployCompose } from "../deploy-compose.mjs";

describe("deployment convergence", () => {
  it("uses native Compose release ordering", () => {
    const commands: string[][] = [];
    const source = { APP_ENV: "uat" };

    deployCompose((arguments_) => commands.push(arguments_), source);

    expect(commands).toEqual([
      ["compose", "-f", "compose.deploy.yaml", "up", "--build", "-d", "--wait", "--remove-orphans"],
    ]);
  });

  it("surfaces a native Compose deployment failure", () => {
    const commands: string[][] = [];
    const source = { APP_ENV: "uat" };

    expect(() =>
      deployCompose((arguments_) => {
        commands.push(arguments_);
        throw new Error("release failed");
      }, source),
    ).toThrow("release failed");
    expect(commands).toEqual([
      ["compose", "-f", "compose.deploy.yaml", "up", "--build", "-d", "--wait", "--remove-orphans"],
    ]);
  });

  it("passes the operator-configured environment through unchanged", () => {
    const environments: NodeJS.ProcessEnv[] = [];
    const source = { APP_ENV: "uat", STORAGE_BUCKET: "pickflick-uat" };

    deployCompose((_arguments, environment) => environments.push(environment), source);

    expect(environments).toEqual([source]);
  });

  it("refuses source-built production deployment", () => {
    const commands: string[][] = [];

    expect(() => deployCompose((arguments_) => commands.push(arguments_), { APP_ENV: "production" }))
      .toThrow(/only run for APP_ENV=uat/);
    expect(commands).toEqual([]);
  });
});
