import type { IClubHubSession } from '@pickflick/contracts';

export function formatSessionPhase(value: string) {
    return value[0] + value.slice(1).toLowerCase();
}

export function formatSessionProgress(session: IClubHubSession, memberCount: number) {
    if (session.phase === 'NOMINATION')
        return `${session.progressCount ?? 0} of ${memberCount} have nominated`;
    if (session.phase === 'SELECTION')
        return `${session.progressCount ?? 0} of ${session.acceptedCount} have submitted`;
    return `${session.acceptedCount} of ${memberCount} Club members have joined`;
}
