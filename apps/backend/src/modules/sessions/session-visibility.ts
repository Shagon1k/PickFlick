import type { IClubVisibility, TSessionPhase } from '@pickflick/contracts';

export function canViewNominationAuthors(session: { phase: TSessionPhase }, club: IClubVisibility) {
    if (session.phase === 'CANCELLED') return false;
    return session.phase === 'COMPLETED'
        ? club.showNominationAuthorsAfter
        : club.showNominationAuthorsDuring;
}

export function canViewSelectionScores(
    session: { phase: TSessionPhase },
    club: IClubVisibility,
    hasSubmitted: boolean,
) {
    if (session.phase === 'COMPLETED') return club.showSelectionScoresAfter;
    const isDuring =
        session.phase === 'SELECTION' || session.phase === 'WATCHING' || session.phase === 'RATING';
    return isDuring && club.showSelectionScoresDuring && hasSubmitted;
}

export function canViewCompletedRatings(club: Pick<IClubVisibility, 'showRatingsAfter'>) {
    return club.showRatingsAfter;
}

export function canViewRatingResults(
    session: { phase: TSessionPhase },
    club: IClubVisibility,
    hasSubmitted: boolean,
) {
    if (session.phase === 'COMPLETED') return canViewCompletedRatings(club);
    return session.phase === 'RATING' && club.showRatingsDuring && hasSubmitted;
}
