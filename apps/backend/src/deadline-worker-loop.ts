import { setTimeout } from 'node:timers/promises';

import type { NominationDeadlines } from './modules/sessions/nominations/nomination-deadlines.js';

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
            await setTimeout(5000, undefined, { signal });
        } catch (error) {
            if (!signal.aborted) throw error;
        }
    }
}
