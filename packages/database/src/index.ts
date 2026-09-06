export interface DatabaseCommandResult {
  readonly applied: number;
  readonly state: "empty";
}

export function inspectMigrationPlan(): DatabaseCommandResult {
  return { applied: 0, state: "empty" };
}

export function inspectSeedPlan(): DatabaseCommandResult {
  return { applied: 0, state: "empty" };
}
