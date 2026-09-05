import { inspectMigrationPlan } from "./index.js";

const result = inspectMigrationPlan();
console.log(`Migration plan ${result.state}; ${result.applied} database changes applied.`);
console.log("Issue #11 owns the first PostgreSQL schema and migration.");
