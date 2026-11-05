'use client';

import { formatInstant, type TInstantFormat } from '#lib/format';
import { useIsHydrated } from '#lib/use-is-hydrated';

import styles from './LocalTime.module.scss';

export interface ILocalTimeProps {
    /** An ISO timestamp. */
    value: string;
    format?: TInstantFormat;
}

/**
 * A moment in the viewer's time zone. The server cannot know that zone, so its UTC text stays
 * invisible until hydration replaces it.
 */
export default function LocalTime({ value, format = 'dateTime' }: ILocalTimeProps) {
    const isHydrated = useIsHydrated();
    // Server markup knows neither the viewer's zone nor their clock, so it carries a UTC date.
    const serverFormat = format === 'relative' ? 'date' : format;
    const text = isHydrated
        ? formatInstant(value, format)
        : formatInstant(value, serverFormat, 'UTC');
    return (
        <time className={styles.localTime} data-pending={!isHydrated || undefined} dateTime={value}>
            {text}
        </time>
    );
}
