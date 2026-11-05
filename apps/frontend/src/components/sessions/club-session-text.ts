import type { IClubHubSession, TSessionPhase } from '@pickflick/contracts';

export const SESSION_PHASE_LABELS: Record<TSessionPhase, string> = {
    NOMINATION: 'Nomination',
    SELECTION: 'Selection',
    WATCHING: 'Watching',
    RATING: 'Rating',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
};

/** A Hub row names the chosen film, else the Session topic. */
export function formatHubSessionTitle(session: IClubHubSession) {
    return session.movie?.title ?? session.topic ?? 'Untitled Session';
}

export function formatSessionPhase(phase: TSessionPhase) {
    return SESSION_PHASE_LABELS[phase];
}

/** Every Club member may nominate; from Selection on, only the Session's participants count. */
export function getProgressTotal(session: IClubHubSession, memberCount: number) {
    return session.phase === 'NOMINATION' ? memberCount : session.acceptedCount;
}

export function formatSessionProgress(session: IClubHubSession, memberCount: number) {
    const total = getProgressTotal(session, memberCount);
    if (session.phase === 'NOMINATION')
        return `${session.progressCount ?? 0} of ${total} have nominated`;
    if (session.phase === 'SELECTION')
        return `${session.progressCount ?? 0} of ${total} have submitted`;
    return `${session.acceptedCount} of ${memberCount} Club members have joined`;
}
