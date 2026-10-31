import { selectionResultSchema } from '../../sessions/selection/selection-result.js';
import type { TClubAchievementKey } from './rule-catalog.js';
import {
    getAverage,
    getLargestBucket,
    getLongestRun,
    getMembersAtScreening,
    readDetails,
    toUtcDayKey,
    toUtcMonthKey,
} from './rule-helpers.js';
import type { TAchievementSession } from './rule-sources.js';

const EVENING_HOUR = 18;
const DECADE = 10;
const COMEBACK_MS = 30 * 24 * 60 * 60 * 1000;
const CULT_RATING = 9;
const SHARED_RATING = 8;
const SILENT_ERA_YEAR = 1930;

export function buildClubAchievements(sessions: TAchievementSession[]) {
    const completed = sessions.filter((session) => session.phase === 'COMPLETED');
    const screenings = completed.map((session) => ({
        session,
        details: readDetails(session.movie),
    }));
    const dated = completed.filter((session) => session.scheduledAt !== null);
    const evidence = {
        sessions: screenings.map(({ session, details }) => ({
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
            genres: details?.genres ?? null,
            year: session.movie?.releaseYear ?? null,
            runtime: details?.runtime ?? null,
            productionCountries: details?.productionCountries ?? null,
        })),
    };
    const hasFullHouse = completed.some((session) =>
        everyMemberAtScreening(session, (participant) => participant.attended === true),
    );
    const hasCriticsCircle = completed.some((session) =>
        everyMemberAtScreening(session, (participant) =>
            session.ratings.some((rating) => rating.participantId === participant.id),
        ),
    );
    const evenings = screenings.filter(
        ({ session }) => session.scheduledAt && session.scheduledAt.getUTCHours() >= EVENING_HOUR,
    );
    const double = getLargestBucket(
        evenings.map(({ session }) => ({
            bucket: toUtcDayKey(session.scheduledAt!),
            value: 1,
        })),
    );
    const runtime = getLargestBucket(
        evenings.map(({ session, details }) => ({
            bucket: toUtcDayKey(session.scheduledAt!),
            value: details?.runtime ?? 0,
        })),
    );
    const month = getLargestBucket(
        dated.map((session) => ({
            bucket: toUtcMonthKey(session.scheduledAt!),
            value: 1,
        })),
    );
    const decades = new Set(
        completed.flatMap((session) =>
            session.movie?.releaseYear ? [Math.floor(session.movie.releaseYear / DECADE)] : [],
        ),
    );
    const genres = new Set(screenings.flatMap(({ details }) => details?.genres ?? []));
    const selections = sessions.flatMap((session) => {
        if (session.type !== 'FULL_CYCLE') return [];
        const parsed = selectionResultSchema.safeParse(session.selectionResult);
        return parsed.success ? [{ id: session.id, ranking: parsed.data.ranking }] : [];
    });
    const hasMargin = selections.some(
        ({ ranking }) => ranking.length > 1 && ranking[0]!.total - ranking[1]!.total === 1,
    );
    const countries = new Set(
        screenings.flatMap(({ details }) => details?.productionCountries ?? []),
    );
    const metrics: Record<TClubAchievementKey, number> = {
        'first-screening': completed.length,
        'full-house': Number(hasFullHouse),
        'critics-circle': Number(hasCriticsCircle),
        'cult-classic': Number(
            completed.some((session) => (getAverage(session) ?? 0) >= CULT_RATING),
        ),
        'perfect-split': Number(hasMargin),
        'double-feature': double,
        'decade-tour': decades.size,
        'marathon-night': runtime,
        'world-tour': countries.size,
        'first-ten': completed.length,
        'packed-calendar': month,
        'shared-taste': getLongestRun(
            completed,
            (session) =>
                (getAverage(session) ?? 0) >= SHARED_RATING && session.scheduledAt !== null,
        ),
        'genre-roulette': genres.size,
        'silent-era': Number(
            completed.some(
                (session) =>
                    session.movie !== null &&
                    session.movie.releaseYear !== null &&
                    session.movie.releaseYear < SILENT_ERA_YEAR,
            ),
        ),
        comeback: Number(
            dated.some(
                (session, index) =>
                    index > 0 &&
                    session.scheduledAt!.getTime() - dated[index - 1]!.scheduledAt!.getTime() >=
                        COMEBACK_MS,
            ),
        ),
    };
    return { metrics, evidence: { ...evidence, selections } };
}

function everyMemberAtScreening(
    session: TAchievementSession,
    qualifies: (participant: TAchievementSession['participants'][number]) => boolean,
) {
    const members = getMembersAtScreening(session);
    return (
        members.length > 0 &&
        members.every((member) =>
            session.participants.some(
                (participant) =>
                    participant.membership.userId === member.userId && qualifies(participant),
            ),
        )
    );
}
