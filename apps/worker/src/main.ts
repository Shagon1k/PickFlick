import { loadRuntimeEnvironment } from "@pickflick/config/environment";

import { runWorker } from "./worker.js";

loadRuntimeEnvironment();
const controller = new AbortController();
const stop = () => controller.abort();

process.once("SIGINT", stop);
process.once("SIGTERM", stop);

await runWorker(controller.signal);
