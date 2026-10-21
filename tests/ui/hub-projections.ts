import type { IClubHub, IClubHubSession, IClubSettings, IClubSummary } from '@pickflick/contracts';
const SETTINGS_CLUB_ID = '10000000-0000-4000-8000-000000000031';
const SECOND_CLUB_ID = '10000000-0000-4000-8000-000000000032';
export function buildHubProjection(
    token: string | undefined,
    club: IClubSummary,
    projection: IClubSettings,
): IClubHub {
    if (club.id !== SETTINGS_CLUB_ID && club.id !== SECOND_CLUB_ID) {
        return {
            club,
            access: projection.access,
            permissions: projection.permissions,
            memberCount: 1,
            sessionCount: 0,
            completedSessionCount: 0,
            memberLimit: 8,
            members: projection.members,
            statistics: {
                sessionsWatched: null,
                sessionsThisYear: null,
                averageRating: null,
                totalWatchHours: null,
                topGenre: null,
                topDirector: null,
                topActor: null,
            },
            recentSessions: [],
            ratingSessions: [],
            historySessions: [],
        };
    }
    const isSecondClub = club.id === SECOND_CLUB_ID;
    const session: IClubHubSession = {
        id: isSecondClub
            ? '30000000-0000-4000-8000-000000000032'
            : '30000000-0000-4000-8000-000000000031',
        ordinal: 1,
        acceptedCount: 2,
        nominatedCount: 1,
        progressCount: 1,
        canJoin: false,
        movie: null,
        phase: isSecondClub ? 'RATING' : 'NOMINATION',
        topic: isSecondClub ? 'Second Club private screening' : 'Midnight private screening',
        scheduledAt: '2026-10-01T20:00:00.000Z',
        location: isSecondClub ? 'Room B' : 'Room A',
        updatedAt: '2026-09-29T12:00:00.000Z',
    };
    applySessionScenario(session, token);
    return {
        club,
        access: projection.access,
        permissions: projection.permissions,
        memberCount: isSecondClub ? 4 : 2,
        sessionCount: isSecondClub ? 7 : 1,
        completedSessionCount: isSecondClub ? 3 : 0,
        memberLimit: 8,
        members: projection.members,
        statistics: {
            sessionsWatched: isSecondClub ? 3 : null,
            sessionsThisYear: isSecondClub ? 3 : null,
            averageRating: null,
            totalWatchHours: null,
            topGenre: null,
            topDirector: null,
            topActor: null,
        },
        activeSession: session,
        recentSessions: [session],
        ratingSessions: isSecondClub ? [session] : [],
        historySessions: [],
    };
}

function applySessionScenario(session: IClubHubSession, token: string | undefined) {
    if (token?.includes('hub-watching')) {
        session.phase = 'WATCHING';
        session.ordinal = 47;
        session.progressCount = null;
        session.scheduledAt = '2026-10-16T20:00:00.000Z';
        session.movie = {
            id: '10000000-0000-4000-8000-000000000037',
            title: 'Selected film',
            year: 2026,
            runtime: 166,
            genres: ['Sci-Fi', 'Drama'],
            posterUrl: null,
        };
    }
    if (token?.includes('session-roster-member-direct')) {
        session.id = '30000000-0000-4000-8000-000000000041';
        session.canJoin = true;
        session.acceptedCount = 0;
        session.progressCount = 0;
    }
}
