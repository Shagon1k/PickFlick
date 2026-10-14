import { setTimeout } from 'node:timers/promises';

import type { NominationDeadlines } from './modules/sessions/nominations/nomination-deadlines.js';

const POLL_INTERVAL_MS = 5000;

export async function runDeadlineWorker(
    deadlines: Pick<NominationDeadlines, 'runOnce'>,
    signal: AbortSignal,
    log: (event: string) => void,
) {
    while (!signal.aborted) {
        try {
            await deadlines.runOnce(new Date(), signal);
        } catch {
            log('deadline.cycle.failed');
        }
        if (signal.aborted) break;
        try {
            await setTimeout(POLL_INTERVAL_MS, undefined, { signal });
        } catch (error) {
            if (!signal.aborted) throw error;
        }
    }
}
