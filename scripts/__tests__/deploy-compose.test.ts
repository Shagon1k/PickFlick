import { describe, expect, it } from "vitest";

import { deployCompose } from "../deploy-compose.mjs";

describe("deployment convergence", () => {
  it("uses native Compose release ordering", () => {
    const commands: string[][] = [];
    const source = { APP_ENV: "uat", SOURCE_REVISION: "a".repeat(40) };

    deployCompose((arguments_) => commands.push(arguments_), source, () => source.SOURCE_REVISION);

    expect(commands).toEqual([
      ["compose", "-f", "compose.deploy.yaml", "up", "--build", "-d", "--wait", "--remove-orphans"],
    ]);
  });

  it("surfaces a native Compose deployment failure", () => {
    const commands: string[][] = [];
    const source = { APP_ENV: "uat", SOURCE_REVISION: "a".repeat(40) };

    expect(() =>
      deployCompose((arguments_) => {
        commands.push(arguments_);
        throw new Error("release failed");
      }, source, () => source.SOURCE_REVISION),
    ).toThrow("release failed");
    expect(commands).toEqual([
      ["compose", "-f", "compose.deploy.yaml", "up", "--build", "-d", "--wait", "--remove-orphans"],
    ]);
  });

  it("passes the clean checked-out source revision to both Compose builds", () => {
    const environments: NodeJS.ProcessEnv[] = [];
    const source = { APP_ENV: "uat", SOURCE_REVISION: "a".repeat(40) };
    const checkedRevision = "b".repeat(40);

    deployCompose(
      (_arguments, environment) => environments.push(environment),
      source,
      (receivedSource) => {
        expect(receivedSource).toBe(source);
        return checkedRevision;
      },
    );

    expect(environments).toHaveLength(1);
    expect(environments.every((environment) => environment.SOURCE_REVISION === checkedRevision)).toBe(true);
  });

  it("refuses source-built production deployment", () => {
    const commands: string[][] = [];

    expect(() =>
      deployCompose((arguments_) => commands.push(arguments_), { APP_ENV: "production" }, () => "a".repeat(40)),
    ).toThrow(/only run for APP_ENV=uat/);
    expect(commands).toEqual([]);
  });
});
