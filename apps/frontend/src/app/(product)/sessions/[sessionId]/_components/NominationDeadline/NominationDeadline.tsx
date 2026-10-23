'use client';

import { useEffect, useState } from 'react';

import { formatUtcDateTime } from '#lib/format';

const MINUTE_MS = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

/** The prototype's relative deadline; the server's render time keeps hydration stable. */
export default function NominationDeadline({
    deadlineAt,
    renderedAt,
}: {
    deadlineAt: string;
    renderedAt: number;
}) {
    const [now, setNow] = useState(renderedAt);
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), MINUTE_MS);
        return () => clearInterval(timer);
    }, []);
    return (
        <time dateTime={deadlineAt} title={formatUtcDateTime(deadlineAt)}>
            {formatRemaining(new Date(deadlineAt).getTime() - now)}
        </time>
    );
}

function formatRemaining(remainingMs: number): string {
    if (remainingMs <= 0) return 'Nomination is closing';
    const minutes = Math.ceil(remainingMs / MINUTE_MS);
    if (minutes < MINUTES_PER_HOUR) return `Nomination closes in ${minutes}m`;
    const hours = Math.floor(minutes / MINUTES_PER_HOUR);
    if (hours < HOURS_PER_DAY)
        return `Nomination closes in ${hours}h ${minutes % MINUTES_PER_HOUR}m`;
    return `Nomination closes in ${Math.floor(hours / HOURS_PER_DAY)}d ${hours % HOURS_PER_DAY}h`;
}
