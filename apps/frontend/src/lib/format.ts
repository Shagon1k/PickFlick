const ISO_DATE_LENGTH = 10;
/** `hh:mm` right after the `T` that ends an ISO date. */
const ISO_TIME_START = ISO_DATE_LENGTH + 1;
const ISO_TIME_LENGTH = 5;
const MINUTES_PER_HOUR = 60;
const AVERAGE_FORMAT = new Intl.NumberFormat('en', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
});
const HOURS_FORMAT = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });

/** A Movie's display title; the provider may omit both the local and the original title. */
export function formatMovieTitle(
    movie?: { title?: string | null; originalTitle?: string | null } | null,
): string {
    return movie?.title ?? movie?.originalTitle ?? 'Untitled film';
}

/** The `YYYY-MM-DD` part of an ISO timestamp, as date inputs and compact labels show it. */
export function toIsoDate(value: string): string {
    return value.slice(0, ISO_DATE_LENGTH);
}

/**
 * A Session's calendar date, or the parts `options` asks for. Sessions store the venue's
 * wall-clock day and time as if in UTC, so they are read in UTC whatever the viewer's zone.
 */
export function formatCalendarDate(
    value: string,
    options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
    return new Intl.DateTimeFormat('en', { ...options, timeZone: 'UTC' }).format(new Date(value));
}

/** The screening's `hh:mm`, or null for a date-only Session (stored at midnight). */
export function toScreeningTime(value: string): string | null {
    const time = value.slice(ISO_TIME_START, ISO_TIME_START + ISO_TIME_LENGTH);
    return time === '00:00' ? null : time;
}

export type TInstantFormat = 'date' | 'dateTime' | 'short' | 'relative';

const INSTANT_FORMATS: Record<Exclude<TInstantFormat, 'relative'>, Intl.DateTimeFormatOptions> = {
    date: { dateStyle: 'medium' },
    dateTime: { dateStyle: 'medium', timeStyle: 'short' },
    short: { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' },
};

const RELATIVE_FORMAT = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' });
const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3600],
    ['minute', 60],
];
const SECOND_MS = 1000;

/** `5 min. ago`, `yesterday`, `3 days ago`: the largest whole unit since `value`. */
function formatRelative(value: string, now: number): string {
    const seconds = (new Date(value).getTime() - now) / SECOND_MS;
    for (const [unit, size] of RELATIVE_UNITS) {
        if (Math.abs(seconds) >= size)
            return RELATIVE_FORMAT.format(Math.trunc(seconds / size), unit);
    }
    return 'just now';
}

/**
 * A moment such as a closing or creation time: `Oct 30, 2026, 7:45 PM`. Without `timeZone` it
 * reads in the viewer's own zone; render it through `LocalTime` so hydration stays stable.
 */
export function formatInstant(
    value: string,
    format: TInstantFormat,
    timeZone?: string,
    now = Date.now(),
): string {
    if (format === 'relative') return formatRelative(value, now);
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
