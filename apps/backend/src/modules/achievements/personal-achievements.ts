import { z } from 'zod';

import {
    getAverage,
    getLongestRun,
    type IAchievementMetric,
    measure,
    readGenres,
} from './achievement-metrics.js';
import type { TAchievementSession } from './achievement-sources.js';

const LONG_REVIEW = 301;
const NIGHT_HOUR = 23;
const EARLY_MS = 3 * 60 * 60 * 1000;
const HOT_DIFFERENCE = 2;
const winnerSchema = z.object({ winnerNominationId: z.string() });

export interface IPersonalAchievementFacts {
    userId: string;
    hasProfile: boolean;
    libraryMovieIds: string[];
    acceptedInviteIds: string[];
    sessions: TAchievementSession[];
}

export function buildPersonalAchievements(
    facts: IPersonalAchievementFacts,
): Record<string, IAchievementMetric> {
    const { userId, sessions } = facts;
    const ownParticipants = new Set(
        sessions.flatMap((session) =>
            session.participants
                .filter((participant) => participant.membership.userId === userId)
                .map((participant) => participant.id),
        ),
    );
    const ballots = sessions.flatMap((session) =>
        session.selectionBallots.filter((ballot) => ownParticipants.has(ballot.participantId)),
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
    const clubs = [...new Set(completed.map((session) => session.clubId))];
    const streak = Math.max(
        0,
        ...clubs.map((clubId) =>
            getLongestRun(
                completed.filter(
                    (session) =>
                        session.clubId === clubId &&
                        session.club.memberships.some(
                            (member) =>
                                member.userId === userId &&
                                session.scheduledAt &&
                                member.joinedAt <= session.scheduledAt &&
                                (!member.leftAt || member.leftAt > session.scheduledAt),
                        ),
                ),
                isAttendee,
            ),
        ),
    );
    const wins = sessions.flatMap((session) => {
        if (session.type !== 'FULL_CYCLE') return [];
        const result = winnerSchema.safeParse(session.selectionResult);
        return result.success
            ? nominations
                  .filter((nomination) => nomination.id === result.data.winnerNominationId)
                  .map((nomination) => nomination.id)
            : [];
    });
    const evidence = {
        ballots: ballots.map((ballot) => ({
            id: ballot.id,
            submittedAt: ballot.submittedAt.toISOString(),
        })),
        ratings: ratings.map((rating) => ({
            id: rating.id,
            score: rating.score,
            commentLength: rating.comment?.length ?? 0,
        })),
        nominations: nominations.map((nomination) => ({
            id: nomination.id,
            genres: readGenres(nomination.movie),
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
    const metric = (value: number, explanation: string) => measure(value, explanation, evidence);
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
    return {
        'opening-credits': metric(
            Number(facts.hasProfile),
            'Current display name and profile image; no image URL is retained in evidence.',
        ),
        'first-vote': metric(
            ballots.length,
            'Submitted live Selection ballots; partial imported scores do not count as ballots.',
        ),
        'reliable-viewer': metric(
            streak,
            'Longest run of explicitly recorded attendance in Completed screenings during one Club membership. Unknown attendance breaks the run.',
        ),
        critic: metric(
            ratings.length,
            'Recorded historical Session Ratings. Personal Rating edits do not add historical ratings.',
        ),
        'panda-patron': metric(
            facts.acceptedInviteIds.length,
            'Accepted Club invitations created by you; pending or declined invitations do not count.',
        ),
        nominator: metric(
            nominations.length,
            'Live nominations and PAST nominations explicitly attributed to you.',
        ),
        'never-miss': metric(
            streak,
            'Same explicit-attendance and membership-window rule as Reliable Viewer.',
        ),
        'taste-maker': metric(
            wins.length,
            'Your nomination ID matches the frozen live winner. PAST chosen films do not prove a Selection win.',
        ),
        'genre-scout': metric(
            new Set(nominations.flatMap((nomination) => readGenres(nomination.movie) ?? [])).size,
            'Distinct known genres from your nominated films in the configured catalog cache.',
        ),
        archivist: metric(
            new Set(facts.libraryMovieIds).size,
            'Distinct films currently saved in Ratings or Watchlist; overlap counts once.',
        ),
        'long-review': metric(
            Math.min(
                LONG_REVIEW,
                Math.max(0, ...ratings.map((rating) => rating.comment?.length ?? 0)),
            ),
            'Longest recorded Session Rating comment in JavaScript characters; comment text is not retained in achievement evidence.',
        ),
        'night-owl': metric(
            Number(
                completed.some(
                    (session) =>
                        isAttendee(session) &&
                        session.scheduledAt &&
                        session.scheduledAt.getUTCHours() >= NIGHT_HOUR &&
                        (session.scheduledAt.getUTCMinutes() > 0 ||
                            session.scheduledAt.getUTCSeconds() > 0 ||
                            session.scheduledAt.getUTCMilliseconds() > 0),
                ),
            ),
            'Recorded attendance at a Completed screening scheduled strictly after 23:00 UTC. Date-only entries cannot qualify.',
        ),
        'early-bird': measure(
            Number(hasEarlyBallot),
            'Ballot submitted from Selection opening through three hours later. Missing live opening timestamps cannot qualify.',
            {
                ...evidence,
                openings: sessions.map((session) => ({
                    id: session.id,
                    openedAt: session.progressEvents[0]?.createdAt.toISOString() ?? null,
                })),
            },
        ),
        'hot-take': measure(
            Number(hot.length > 0),
            'Absolute difference of at least two from the received historical average, including your own rating. Only currently accessible, visible Completed results qualify.',
            { qualifying: hot },
        ),
    };
}

function canReadAverage(session: TAchievementSession, userId: string) {
    const member = session.club.memberships.find(
        (membership) => membership.userId === userId && membership.status === 'ACTIVE',
    );
    return member && (member.role !== 'MEMBER' || session.showRatingResults);
}
