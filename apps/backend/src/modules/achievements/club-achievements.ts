import { movieDetailsSchema } from '@pickflick/contracts';
import { z } from 'zod';

import {
    getAverage,
    getLargestBucket,
    getLongestRun,
    getMembersAtScreening,
    type IAchievementMetric,
    measure,
    readGenres,
} from './achievement-metrics.js';
import type { TAchievementSession } from './achievement-sources.js';

const DATE_LENGTH = 10;
const MONTH_LENGTH = 7;
const EVENING_HOUR = 18;
const DECADE = 10;
const COMEBACK_MS = 30 * 24 * 60 * 60 * 1000;
const CULT_RATING = 9;
const SHARED_RATING = 8;
const selectionMarginSchema = z.object({ ranking: z.array(z.object({ total: z.number() })) });

export function buildClubAchievements(
    sessions: TAchievementSession[],
): Record<string, IAchievementMetric> {
    const completed = sessions.filter((session) => session.phase === 'COMPLETED');
    const dated = completed.filter((session) => session.scheduledAt !== null);
    const evidence = {
        sessions: completed.map((session) => ({
            id: session.id,
            date: session.scheduledAt?.toISOString() ?? null,
            members: getMembersAtScreening(session).map((member) => member.id),
            accepted: session.participants
                .filter((participant) => participant.attended === true)
                .map((participant) => participant.membershipId),
            ratings: session.ratings.map((rating) => ({
                id: rating.id,
                participantId: rating.participantId,
                score: rating.score,
            })),
            genres: readGenres(session.movie),
            year: session.movie?.releaseYear ?? null,
            metadata: getRuntime(session),
        })),
    };
    const metric = (value: number | null, explanation: string) =>
        measure(value, explanation, evidence);
    const hasFullHouse = completed.some((session) => {
        const members = getMembersAtScreening(session);
        return (
            members.length > 0 &&
            members.every((member) =>
                session.participants.some(
                    (participant) =>
                        participant.membershipId === member.id && participant.attended === true,
                ),
            )
        );
    });
    const hasCriticsCircle = completed.some((session) => {
        const members = getMembersAtScreening(session);
        return (
            members.length > 0 &&
            members.every((member) =>
                session.participants.some(
                    (participant) =>
                        participant.membershipId === member.id &&
                        session.ratings.some((rating) => rating.participantId === participant.id),
                ),
            )
        );
    });
    const evenings = dated.filter((session) => session.scheduledAt!.getUTCHours() >= EVENING_HOUR);
    const double = getLargestBucket(
        evenings.map((session) => ({
            bucket: session.scheduledAt!.toISOString().slice(0, DATE_LENGTH),
            value: 1,
        })),
    );
    const runtime = getLargestBucket(
        evenings.map((session) => ({
            bucket: session.scheduledAt!.toISOString().slice(0, DATE_LENGTH),
            value: getRuntime(session) ?? 0,
        })),
    );
    const month = getLargestBucket(
        dated.map((session) => ({
            bucket: session.scheduledAt!.toISOString().slice(0, MONTH_LENGTH),
            value: 1,
        })),
    );
    const decades = new Set(
        completed.flatMap((session) =>
            session.movie?.releaseYear ? [Math.floor(session.movie.releaseYear / DECADE)] : [],
        ),
    );
    const genres = new Set(completed.flatMap((session) => readGenres(session.movie) ?? []));
    const hasMargin = sessions.some((session) => {
        if (session.type !== 'FULL_CYCLE') return false;
        const parsed = selectionMarginSchema.safeParse(session.selectionResult);
        return (
            parsed.success &&
            parsed.data.ranking.length > 1 &&
            parsed.data.ranking[0]!.total - parsed.data.ranking[1]!.total === 1
        );
    });
    return {
        'first-screening': metric(
            completed.length,
            'Completed screenings; repeat viewings and PAST imports count.',
        ),
        'full-house': metric(
            Number(hasFullHouse),
            'Only explicit recorded attendance counts. Membership is reconstructed at the scheduled date; missing dates cannot qualify.',
        ),
        'critics-circle': metric(
            Number(hasCriticsCircle),
            'Recorded ratings for every member at the scheduled date. Missing dates or ratings cannot qualify.',
        ),
        'cult-classic': metric(
            Number(completed.some((session) => (getAverage(session) ?? 0) >= CULT_RATING)),
            'At least one received historical rating; missing ratings are unknown, not zero.',
        ),
        'perfect-split': measure(
            Number(hasMargin),
            'One point between the first two frozen live Selection totals; imported matrices do not establish an outcome.',
            {
                selections: sessions
                    .filter(
                        (session) =>
                            session.selectionResult !== null && session.type === 'FULL_CYCLE',
                    )
                    .map((session) => ({
                        id: session.id,
                        ranking: selectionMarginSchema.parse(session.selectionResult).ranking,
                    })),
            },
        ),
        'double-feature': metric(
            double,
            'Largest screening count on one scheduled UTC evening. Date-only screenings cannot qualify.',
        ),
        'decade-tour': metric(
            decades.size,
            'Distinct known release decades from cached films; missing years add no evidence.',
        ),
        'marathon-night': metric(
            runtime,
            'Largest known runtime sum on one scheduled UTC evening, in minutes. Missing runtime adds no evidence.',
        ),
        'world-tour': metric(
            null,
            'Evidence unavailable: the catalog does not record production countries. Language is not a country.',
        ),
        'first-ten': metric(
            completed.length,
            'Completed screenings; repeat viewings and PAST imports count.',
        ),
        'packed-calendar': metric(
            month,
            'Largest count in a scheduled UTC month; undated screenings add no evidence.',
        ),
        'shared-taste': metric(
            getLongestRun(
                completed,
                (session) =>
                    (getAverage(session) ?? 0) >= SHARED_RATING && session.scheduledAt !== null,
            ),
            'Longest run in scheduled-date order, then Session ID. Missing averages or dates break the run.',
        ),
        'genre-roulette': metric(
            genres.size,
            'Distinct exact genre names in the configured catalog cache; missing genres add no evidence.',
        ),
        'silent-era': metric(
            null,
            'Evidence unavailable: the catalog does not record whether a film is black-and-white. Monochrome artwork is not evidence.',
        ),
        comeback: metric(
            Number(
                dated.some(
                    (session, index) =>
                        index > 0 &&
                        session.scheduledAt!.getTime() - dated[index - 1]!.scheduledAt!.getTime() >=
                            COMEBACK_MS,
                ),
            ),
            'A gap of at least 30 days between consecutive known scheduled screenings.',
        ),
    };
}

function getRuntime(session: TAchievementSession) {
    const parsed = movieDetailsSchema.safeParse(session.movie?.details[0]?.data);
    return parsed.success ? parsed.data.runtime : null;
}
