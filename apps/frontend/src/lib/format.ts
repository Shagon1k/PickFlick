const ISO_DATE_LENGTH = 10;
const MINUTES_PER_HOUR = 60;
const AVERAGE_FORMAT = new Intl.NumberFormat('en', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
});
const HOURS_FORMAT = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });

/** The `YYYY-MM-DD` part of an ISO timestamp, as date inputs and compact labels show it. */
export function toIsoDate(value: string): string {
    return value.slice(0, ISO_DATE_LENGTH);
}

/**
 * A Session's calendar date. Sessions store the chosen day at midnight UTC, so the day is read in
 * UTC whatever the viewer's zone.
 */
export function formatCalendarDate(value: string): string {
    return new Date(value).toLocaleDateString('en', { dateStyle: 'medium', timeZone: 'UTC' });
}

export type TInstantFormat = 'date' | 'dateTime' | 'short';

const INSTANT_FORMATS: Record<TInstantFormat, Intl.DateTimeFormatOptions> = {
    date: { dateStyle: 'medium' },
    dateTime: { dateStyle: 'medium', timeStyle: 'short' },
    short: { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' },
};

/**
 * A moment such as a closing or creation time: `Oct 30, 2026, 7:45 PM`. Without `timeZone` it
 * reads in the viewer's own zone; render it through `LocalTime` so hydration stays stable.
 */
export function formatInstant(value: string, format: TInstantFormat, timeZone?: string): string {
    return new Date(value).toLocaleString('en', { ...INSTANT_FORMATS[format], timeZone });
}

/** A rating average, always with one decimal: `8.0`, `7.5`. */
export function formatAverage(value: number): string {
    return AVERAGE_FORMAT.format(value);
}

/** A number of hours with at most one decimal: `12`, `12.5`. */
export function formatHours(value: number): string {
    return HOURS_FORMAT.format(value);
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
