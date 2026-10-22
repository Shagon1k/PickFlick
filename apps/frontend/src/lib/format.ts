const ISO_DATE_LENGTH = 10;
const MINUTES_PER_HOUR = 60;

/** The `YYYY-MM-DD` part of an ISO timestamp, as date inputs and compact labels show it. */
export function toIsoDate(value: string): string {
    return value.slice(0, ISO_DATE_LENGTH);
}

/** A calendar date in UTC, the zone every PickFlick date is shown in. */
export function formatUtcDate(value: string): string {
    return new Date(value).toLocaleDateString('en', { timeZone: 'UTC' });
}

/** A date and time in UTC with the zone written out. */
export function formatUtcDateTime(value: string): string {
    const formatted = new Date(value).toLocaleString('en', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC',
    });
    return `${formatted} UTC`;
}

/** A runtime such as `2h 46m`, or null when the provider sent none. */
export function formatRuntime(minutes: number | null): string | null {
    if (!minutes) return null;
    const hours = Math.floor(minutes / MINUTES_PER_HOUR);
    return hours ? `${hours}h ${minutes % MINUTES_PER_HOUR}m` : `${minutes}m`;
}

/** A count with its noun in the right number: `1 session`, `3 sessions`. */
export function formatCount(count: number, singular: string, plural = `${singular}s`): string {
    return `${count} ${count === 1 ? singular : plural}`;
}

/** The two-letter placeholder shown where a Club or member has no image. */
export function getMonogram(name: string): string {
    return name.slice(0, 2).toUpperCase();
}
