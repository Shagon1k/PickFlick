import { loadWorkerEnvironment } from "@pickflick/config/environment";

import { runWorker } from "./worker.js";

loadWorkerEnvironment();
const controller = new AbortController();
const stop = () => controller.abort();

process.once("SIGINT", stop);
process.once("SIGTERM", stop);

await runWorker(controller.signal);
