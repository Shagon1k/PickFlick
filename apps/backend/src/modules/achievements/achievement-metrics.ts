import { movieDetailsSchema } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import type { TAchievementSession } from './achievement-sources.js';

export function readDetails(movie: { details: { data: Prisma.JsonValue }[] } | null) {
    const details = movieDetailsSchema.safeParse(movie?.details[0]?.data);
    return details.success ? details.data : null;
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
