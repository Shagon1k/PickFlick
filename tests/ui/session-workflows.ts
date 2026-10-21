import { randomUUID } from 'node:crypto';

import type {
    IClubHub,
    IClubHubSession,
    TCreateSession,
    TSession,
    TUpdateSession,
} from '@pickflick/contracts';

import { settingsProjection } from './club-projections.ts';
import {
    readJson,
    sendError,
    sendJson,
    type TMockRequest,
    type TMockResponse,
} from './mock-http.ts';

const sessionsByToken = new Map<string | undefined, Map<string, TSession>>();
export function sessionHub(token: string | undefined): IClubHub {
    const settings = settingsProjection(token);
    const sessions = [...(sessionsByToken.get(token)?.values() ?? [])];
    const row = (session: TSession): IClubHubSession => ({
        id: session.id,
        ordinal: sessions.findIndex(({ id }) => id === session.id) + 1,
        acceptedCount: 1,
        nominatedCount: 0,
        progressCount: session.phase === 'NOMINATION' ? 0 : null,
        canJoin: false,
        movie: session.movieId
            ? {
                  id: session.movieId,
                  title: 'Selected Movie',
                  year: 2026,
                  runtime: 120,
                  genres: ['Drama'],
                  posterUrl: null,
              }
            : null,
        phase: session.phase,
        ...(session.topic ? { topic: session.topic } : {}),
        ...(session.scheduledAt ? { scheduledAt: session.scheduledAt } : {}),
        ...(session.location ? { location: session.location } : {}),
        updatedAt: '2026-10-11T12:00:00.000Z',
    });
    return {
        club: settings.club,
        access: settings.access,
        permissions: settings.permissions,
        memberCount: 3,
        sessionCount: sessions.filter(({ phase }) => phase !== 'CANCELLED').length,
        completedSessionCount: 0,
        memberLimit: 8,
        members: settings.members,
        statistics: {
            sessionsWatched: null,
            sessionsThisYear: null,
            averageRating: null,
            totalWatchHours: null,
            topGenre: null,
            topDirector: null,
            topActor: null,
        },
        recentSessions: sessions.map(row),
        ratingSessions: [],
        historySessions: sessions.filter(({ phase }) => phase === 'CANCELLED').map(row),
        activeSession: sessions.map(row).find(({ phase }) => phase !== 'CANCELLED'),
    };
}
export function handleSessionWorkflow(
    request: TMockRequest,
    response: TMockResponse,
    pathname: string,
    token: string | undefined,
): boolean {
    const creation = /^\/clubs\/([\da-f-]{36})\/sessions$/u.exec(pathname);
    const detail = /^\/sessions\/([\da-f-]{36})(\/cancel)?$/u.exec(pathname);
    if (!creation && !detail) return false;
    if (!token?.startsWith('valid')) {
        sendError(response, 401, 'UNAUTHORIZED', 'session-auth');
        return true;
    }
    const settings = settingsProjection(token);
    const sessions = sessionsByToken.get(token) ?? new Map<string, TSession>();
    sessionsByToken.set(token, sessions);
    const session = detail ? sessions.get(detail[1] ?? '') : undefined;
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
    readJson<TCreateSession | TUpdateSession>(request, (input) => {
        if (input.topic === 'API failure') {
            sendError(response, 503, 'SERVICE_UNAVAILABLE', 'session-save');
            return;
        }
        if (creation && 'type' in input) {
            const result: TSession = {
                ...input,
                id: randomUUID(),
                clubId: creation[1] ?? '',
                clubName: settings.club.name,
                phase: input.type === 'FULL_CYCLE' ? 'NOMINATION' : 'WATCHING',
                version: 1,
                phaseVersion: 1,
                progressVersion: 1,
                nominations: null,
                selection: null,
                selectionOutcome: null,
                canEdit: true,
                canCancel: true,
                topic: input.topic ?? null,
                notes: input.notes ?? null,
            };
            sessions.set(result.id, result);
            sendJson(response, 201, result);
        } else if (session && 'version' in input) {
            const result: TSession = detail?.[2]
                ? {
                      ...session,
                      phase: 'CANCELLED',
                      canEdit: false,
                      canCancel: false,
                      version: session.version + 1,
                  }
                : { ...session, ...input, version: session.version + 1 };
            sessions.set(result.id, result);
            sendJson(response, detail?.[2] ? 201 : 200, result);
        }
    });
    return true;
}
