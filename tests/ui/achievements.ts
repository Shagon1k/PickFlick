import type { TAchievement, TAchievements } from '@pickflick/contracts';

import { sendError, sendJson, type TMockRequest, type TMockResponse } from './mock-http.ts';

const failedReads = new Set<string>();

export function handleAchievements(
    request: TMockRequest,
    response: TMockResponse,
    pathname: string,
    token: string | undefined,
) {
    if (
        pathname !== '/library/achievements' &&
        !/^\/clubs\/[0-9a-f-]{36}\/achievements$/u.test(pathname)
    )
        return false;
    if (!token?.startsWith('valid')) {
        sendError(response, 401, 'UNAUTHORIZED', 'request-achievements');
        return true;
    }
    if (token.includes('achievements-denied')) {
        sendError(response, 404, 'NOT_FOUND', 'request-achievements');
        return true;
    }
    if (token.includes('achievements-transient') && !failedReads.has(token)) {
        failedReads.add(token);
        sendError(response, 503, 'SERVICE_UNAVAILABLE', 'request-achievements');
        return true;
    }
    const build = (
        key: string,
        title: string,
        progress: number | null,
        target: number,
    ): TAchievement => ({
        key,
        title,
        progress,
        target,
        version: 1,
        description: 'A recorded film activity milestone with a clear source rule.',
        status: progress === null || progress === 0 ? 'not-started' : 'in-progress',
        awardedAt: null,
        explanation:
            progress === null
                ? 'Result-based Club achievements are visible to Admins and Moderators only. Their progress and award history are private.'
                : 'Recorded source events; missing evidence cannot qualify.',
    });
    const first = build('first', 'First Screening', 1, 1);
    first.status = 'unlocked';
    first.awardedAt = '2026-10-01T20:00:00.000Z';
    const items = [
        first,
        build('ten', 'The First Ten', 7, 10),
        build('genre', 'Genre Scout', 3, 5),
        build('night', 'Night Owl', 0, 1),
        build('critics-circle', 'Critics Circle', null, 1),
        build('long', 'A Very Long Achievement Title That Must Wrap Without Hiding Its Rule', 0, 1),
    ];
    const body: TAchievements = { items: token.includes('achievements-empty') ? [] : items };
    sendJson(response, 200, body);
    return true;
}
