/** A calendar date in UTC, the zone every PickFlick date is shown in. */
export function formatUtcDate(value: string): string {
    return new Date(value).toLocaleDateString('en', { timeZone: 'UTC' });
}

/** A date and time in UTC with the zone written out. */
export function formatUtcDateTime(value: string): string {
    return `${new Date(value).toLocaleString('en', { timeZone: 'UTC' })} UTC`;
}

/** The two-letter placeholder shown where a Club or member has no image. */
export function getMonogram(name: string): string {
    return name.slice(0, 2).toUpperCase();
}
