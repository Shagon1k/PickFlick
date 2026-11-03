import type { TClubRole } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { getClubEntitlements } from '../clubs/access/club-tiers.js';

type TVisibilitySession = Pick<
    Prisma.SessionGetPayload<object>,
    | 'phase'
    | 'clubId'
    | 'showNominationAuthors'
    | 'showVoteResults'
    | 'showRatingResults'
    | 'showNominationAuthorsDuring'
    | 'showNominationAuthorsAfter'
    | 'showSelectionScoresDuring'
    | 'showSelectionScoresAfter'
    | 'showRatingsDuring'
    | 'showRatingsAfter'
>;

export function canViewNominationAuthors(session: TVisibilitySession) {
    if (session.showNominationAuthorsDuring === null) return session.showNominationAuthors;
    if (session.phase === 'CANCELLED') return false;
    return session.phase === 'COMPLETED'
        ? session.showNominationAuthorsAfter === true
        : session.showNominationAuthorsDuring;
}

export function canViewSelectionScores(session: TVisibilitySession, hasSubmitted: boolean) {
    if (session.showSelectionScoresDuring === null) return false;
    if (session.phase === 'COMPLETED') return session.showSelectionScoresAfter === true;
    const isDuring =
        session.phase === 'SELECTION' || session.phase === 'WATCHING' || session.phase === 'RATING';
    return isDuring && session.showSelectionScoresDuring && hasSubmitted;
}

export function canViewSelectionResults(
    session: TVisibilitySession,
    role: TClubRole,
    hasSubmitted: boolean,
) {
    // Legacy Sessions never disclosed named ballots; their frozen aggregate policy stays intact.
    if (session.showSelectionScoresDuring === null)
        return (
            role !== 'MEMBER' ||
            (getClubEntitlements(session.clubId).tier === 'PRO' && session.showVoteResults)
        );
    return canViewSelectionScores(session, hasSubmitted);
}

export function canViewCompletedRatings(
    session: Pick<TVisibilitySession, 'showRatingsAfter' | 'showRatingResults'>,
    role: TClubRole,
) {
    return session.showRatingsAfter ?? (role !== 'MEMBER' || session.showRatingResults);
}

export function canViewRatingResults(
    session: TVisibilitySession,
    role: TClubRole,
    hasSubmitted: boolean,
) {
    if (session.phase === 'COMPLETED') return canViewCompletedRatings(session, role);
    return session.phase === 'RATING' && session.showRatingsDuring === true && hasSubmitted;
}
