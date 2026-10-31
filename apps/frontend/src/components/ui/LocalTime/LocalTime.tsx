'use client';

import { formatInstant, type TInstantFormat } from '#lib/format';
import { useViewerTimeZone } from '#lib/use-is-hydrated';

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
    const timeZone = useViewerTimeZone();
    return (
        <time
            className={styles.localTime}
            data-pending={timeZone ? true : undefined}
            dateTime={value}
        >
            {formatInstant(value, format, timeZone)}
        </time>
    );
}
