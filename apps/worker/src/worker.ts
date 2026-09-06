import { SERVICE_NAMES, type ServiceStatus } from "@pickflick/contracts";

export const workerStatus: ServiceStatus = {
  service: SERVICE_NAMES.worker,
  status: "scaffold",
};

export async function runWorker(signal: AbortSignal): Promise<void> {
  console.log(`PickFlick ${workerStatus.service} ${workerStatus.status} ready.`);
  if (signal.aborted) return;

  await new Promise<void>((resolve) => {
    const keepAlive = setInterval(() => undefined, 60_000);
    signal.addEventListener(
      "abort",
      () => {
        clearInterval(keepAlive);
        resolve();
      },
      { once: true },
    );
  });
}
