import { settingsProjection } from './club-projections.mjs';
import { readJson, sendError, sendJson } from './mock-http.mjs';

const sessionsByToken = new Map();
export function sessionHub(token) {
    const settings = settingsProjection(token);
    const sessions = [...(sessionsByToken.get(token)?.values() ?? [])];
    const row = (session) => ({ ...session, updatedAt: '2026-10-11T12:00:00.000Z' });
    return {
        club: settings.club,
        access: settings.access,
        permissions: settings.permissions,
        memberCount: 3,
        sessionCount: sessions.filter(({ phase }) => phase !== 'CANCELLED').length,
        completedSessionCount: 0,
        recentSessions: sessions.map(row),
        ratingSessions: [],
        historySessions: sessions.filter(({ phase }) => phase === 'CANCELLED').map(row),
        activeSession: sessions.find(({ phase }) => phase !== 'CANCELLED'),
    };
}
export function handleSessionWorkflow(request, response, pathname, token) {
    const creation = pathname.match(/^\/clubs\/([\da-f-]{36})\/sessions$/u);
    const detail = pathname.match(/^\/sessions\/([\da-f-]{36})(\/cancel)?$/u);
    if (!creation && !detail) return false;
    if (!token?.startsWith('valid')) {
        sendError(response, 401, 'UNAUTHORIZED', 'session-auth');
        return true;
    }
    const settings = settingsProjection(token);
    const sessions = sessionsByToken.get(token) ?? new Map();
    sessionsByToken.set(token, sessions);
    const session = detail ? sessions.get(detail[1]) : null;
    if (detail && !session) {
        sendError(response, 404, 'NOT_FOUND', 'session-private');
        return true;
    }
    if (request.method === 'GET') {
        sendJson(response, 200, session);
        return true;
    }
    if (!settings.permissions.manageSessions) {
        sendError(response, 403, 'FORBIDDEN', 'session-role');
        return true;
    }
    readJson(request, (input) => {
        if (input.topic === 'API failure') {
            sendError(response, 503, 'UNAVAILABLE', 'session-save');
            return;
        }
        if (creation) {
            const result = {
                ...input,
                clubId: creation[1],
                clubName: settings.club.name,
                phase: input.type === 'FULL_CYCLE' ? 'NOMINATION' : 'WATCHING',
                version: 1,
                canEdit: true,
                canCancel: true,
                topic: input.topic ?? null,
                notes: input.notes ?? null,
            };
            sessions.set(result.id, result);
            sendJson(response, 201, result);
        } else {
            const result = detail[2]
                ? {
                      ...session,
                      phase: 'CANCELLED',
                      canEdit: false,
                      canCancel: false,
                      version: session.version + 1,
                  }
                : { ...session, ...input, version: session.version + 1 };
            sessions.set(result.id, result);
            sendJson(response, detail[2] ? 201 : 200, result);
        }
    });
    return true;
}
