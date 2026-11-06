import type { TWatchlistPriority } from '@pickflick/contracts';

/** Watchlist priorities from lowest to highest, with the label every control shows. */
export const WATCHLIST_PRIORITIES: { value: TWatchlistPriority; label: string }[] = [
    { value: 'LOW', label: 'Low' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'HIGH', label: 'High' },
];
