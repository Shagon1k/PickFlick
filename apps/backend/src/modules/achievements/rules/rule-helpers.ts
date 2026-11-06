import type { Prisma } from '@pickflick/database';

import { readCachedDetails } from '../../movies/cached-details.js';
import type { TAchievementSession } from './rule-sources.js';

export function readDetails(movie: { details: { data: Prisma.JsonValue }[] } | null) {
    return readCachedDetails(movie?.details[0]);
}

export function getAverage(session: TAchievementSession) {
    return session.ratings.length
        ? session.ratings.reduce((sum, rating) => sum + rating.score, 0) / session.ratings.length
        : null;
}

export function getLongestRun<TItem>(items: TItem[], qualifies: (item: TItem) => boolean) {
    let longest = 0;
    let current = 0;
    for (const item of items) {
        current = qualifies(item) ? current + 1 : 0;
        longest = Math.max(longest, current);
    }
    return longest;
}

export function getLargestBucket(entries: { bucket: string; value: number }[]) {
    const buckets = new Map<string, number>();
    for (const entry of entries) {
        buckets.set(entry.bucket, (buckets.get(entry.bucket) ?? 0) + entry.value);
    }
    return Math.max(0, ...buckets.values());
}

export function getMembersAtScreening(session: TAchievementSession) {
    const date = session.scheduledAt;
    return date
        ? session.club.memberships.filter(
              (member) => member.joinedAt <= date && (!member.leftAt || member.leftAt > date),
          )
        : [];
}

/** UTC calendar keys: `2026-10-01` for a day, `2026-10` for a month. */
export function toUtcDayKey(date: Date) {
    return date.toISOString().slice(0, 'YYYY-MM-DD'.length);
}

export function toUtcMonthKey(date: Date) {
    return date.toISOString().slice(0, 'YYYY-MM'.length);
}
