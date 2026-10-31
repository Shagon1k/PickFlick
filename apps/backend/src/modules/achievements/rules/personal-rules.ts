import { selectionResultSchema } from '../../sessions/selection/selection-result.js';
import type { TPersonalAchievementKey } from './rule-catalog.js';
import { getAverage, getLongestRun, getMembersAtScreening, readDetails } from './rule-helpers.js';
import type { TAchievementSession } from './rule-sources.js';

const LONG_REVIEW = 301;
const NIGHT_HOUR = 23;
const EARLY_MS = 3 * 60 * 60 * 1000;
const HOT_DIFFERENCE = 2;
const HOUR_MS = 60 * 60 * 1000;

export interface IPersonalAchievementFacts {
    userId: string;
    hasProfile: boolean;
    libraryMovieIds: string[];
    acceptedInviteIds: string[];
    sessions: TAchievementSession[];
}

export function buildPersonalAchievements(facts: IPersonalAchievementFacts) {
    const { userId, sessions } = facts;
    const ownParticipants = new Set(
        sessions.flatMap((session) =>
            session.participants
                .filter((participant) => participant.membership.userId === userId)
                .map((participant) => participant.id),
        ),
    );
    const ballots = sessions.flatMap((session) =>
        session.selectionBallots
            .filter((ballot) => ownParticipants.has(ballot.participantId))
            .map((ballot) => ({ ...ballot, sessionId: session.id })),
    );
    const ratings = sessions.flatMap((session) =>
        session.ratings.filter((rating) => ownParticipants.has(rating.participantId)),
    );
    const nominations = sessions.flatMap((session) => [
        ...session.nominations.filter(
            (nomination) => nomination.participant.membership.userId === userId,
        ),
        ...session.pastNominations.filter((nomination) => nomination.nominator?.userId === userId),
    ]);
    const completed = sessions.filter((session) => session.phase === 'COMPLETED');
    const isAttendee = (session: TAchievementSession) =>
        session.participants.some(
            (participant) => ownParticipants.has(participant.id) && participant.attended === true,
        );
    const membershipIds = [
        ...new Set(
            completed.flatMap((session) =>
                getMembersAtScreening(session)
                    .filter((member) => member.userId === userId)
                    .map((member) => member.id),
            ),
        ),
    ];
    const streak = Math.max(
        0,
        ...membershipIds.map((membershipId) =>
            getLongestRun(
                completed.filter((session) =>
                    getMembersAtScreening(session).some((member) => member.id === membershipId),
                ),
                isAttendee,
            ),
        ),
    );
    const wins = sessions.flatMap((session) => {
        if (session.type !== 'FULL_CYCLE') return [];
        const result = selectionResultSchema.safeParse(session.selectionResult);
        return result.success
            ? nominations
                  .filter((nomination) => nomination.id === result.data.winnerNominationId)
                  .map((nomination) => nomination.id)
            : [];
    });
    const evidence = {
        ballots: ballots.map((ballot) => ({
            id: ballot.id,
            sessionId: ballot.sessionId,
            submittedAt: ballot.submittedAt.toISOString(),
        })),
        ratings: ratings.map((rating) => ({
            id: rating.id,
            score: rating.score,
            commentLength: rating.comment?.length ?? 0,
        })),
        nominations: nominations.map((nomination) => ({
            id: nomination.id,
            genres: readDetails(nomination.movie)?.genres ?? null,
        })),
        wins,
        libraryMovieIds: facts.libraryMovieIds,
        acceptedInviteIds: facts.acceptedInviteIds,
        hasProfile: facts.hasProfile,
        screenings: completed.map((session) => ({
            id: session.id,
            clubId: session.clubId,
            date: session.scheduledAt?.toISOString() ?? null,
            accepted: isAttendee(session),
        })),
    };
    const hasEarlyBallot = sessions.some((session) => {
        const opened = session.progressEvents[0]?.createdAt;
        return (
            opened &&
            session.selectionBallots.some(
                (ballot) =>
                    ownParticipants.has(ballot.participantId) &&
                    ballot.submittedAt >= opened &&
                    ballot.submittedAt.getTime() - opened.getTime() <= EARLY_MS,
            )
        );
    });
    const hot = completed
        .filter((session) => canReadAverage(session, userId))
        .flatMap((session) => {
            const average = getAverage(session);
            return session.ratings
                .filter(
                    (rating) =>
                        ownParticipants.has(rating.participantId) &&
                        average !== null &&
                        Math.abs(rating.score - average) >= HOT_DIFFERENCE,
                )
                .map((rating) => ({
                    sessionId: session.id,
                    ratingId: rating.id,
                    score: rating.score,
                    average,
                }));
        });
    const metrics: Record<TPersonalAchievementKey, number> = {
        'opening-credits': Number(facts.hasProfile),
        'first-vote': ballots.length,
        'reliable-viewer': streak,
        critic: ratings.length,
        'panda-patron': facts.acceptedInviteIds.length,
        nominator: nominations.length,
        'never-miss': streak,
        'taste-maker': wins.length,
        'genre-scout': new Set(
            nominations.flatMap((nomination) => readDetails(nomination.movie)?.genres ?? []),
        ).size,
        archivist: new Set(facts.libraryMovieIds).size,
        'long-review': Math.min(
            LONG_REVIEW,
            Math.max(0, ...ratings.map((rating) => rating.comment?.length ?? 0)),
        ),
        'night-owl': Number(
            completed.some(
                (session) =>
                    isAttendee(session) &&
                    session.scheduledAt &&
                    isStrictlyAfterElevenUtc(session.scheduledAt),
            ),
        ),
        'early-bird': Number(hasEarlyBallot),
        'hot-take': Number(hot.length > 0),
    };
    return {
        metrics,
        evidence: {
            ...evidence,
            openings: sessions.map((session) => ({
                id: session.id,
                openedAt: session.progressEvents[0]?.createdAt.toISOString() ?? null,
            })),
            qualifying: hot,
        },
    };
}

function canReadAverage(session: TAchievementSession, userId: string) {
    const member = session.club.memberships.find(
        (membership) => membership.userId === userId && membership.status === 'ACTIVE',
    );
    return member && (member.role !== 'MEMBER' || session.showRatingResults);
}

/** Night Owl: strictly after 23:00 on its UTC date, so 23:00 exactly does not count. */
function isStrictlyAfterElevenUtc(date: Date) {
    return date.getUTCHours() === NIGHT_HOUR && date.getTime() % HOUR_MS > 0;
}
