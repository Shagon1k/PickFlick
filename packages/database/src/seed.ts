import { inspectSeedPlan } from "./index.js";

const result = inspectSeedPlan();
console.log(`Seed plan ${result.state}; ${result.applied} records written.`);
console.log("Issue #11 owns the first guarded local/test seed.");
