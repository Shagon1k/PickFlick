import { describe, expect, it } from 'vitest';

import { completeWithin, DrainController } from '../drain.js';

describe('DrainController', () => {
    it('stops new work and waits for active work', async () => {
        const drain = new DrainController();
        let finish!: () => void;
        const active = drain.run(() => new Promise<void>((resolve) => (finish = resolve)));

        const waiting = drain.waitForIdle(1_000);
        expect(drain.acceptingWork).toBe(false);
        expect(() => drain.run(async () => undefined)).toThrow(/cannot accept new work/);

        finish();
        await expect(active).resolves.toBeUndefined();
        await expect(waiting).resolves.toBe(true);
    });

    it('reports a bounded timeout', async () => {
        await expect(completeWithin(new Promise(() => undefined), 5)).resolves.toBe(false);
    });
});
