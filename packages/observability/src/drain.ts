export class DrainController {
  private accepting = true;
  private readonly active = new Set<Promise<unknown>>();

  get acceptingWork(): boolean {
    return this.accepting;
  }

  get activeWorkCount(): number {
    return this.active.size;
  }

  stopAccepting(): void {
    this.accepting = false;
  }

  run<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.accepting) {
      throw new Error("Runtime is draining and cannot accept new work.");
    }

    const activeOperation = operation();
    this.active.add(activeOperation);
    void activeOperation.finally(() => this.active.delete(activeOperation)).catch(() => undefined);
    return activeOperation;
  }

  async waitForIdle(timeoutMilliseconds: number): Promise<boolean> {
    this.stopAccepting();
    return completeWithin(Promise.allSettled([...this.active]), timeoutMilliseconds);
  }
}

export async function completeWithin(operation: Promise<unknown>, timeoutMilliseconds: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMilliseconds);
  });

  try {
    return await Promise.race([operation.then(() => true), timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
