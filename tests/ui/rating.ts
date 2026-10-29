import {
    closeRatingSchema,
    type ISessionRoster,
    submitRatingSchema,
    type TLiveSelectionOutcome,
    type TRating,
    type TSession,
    type TSubmitRating,
} from '@pickflick/contracts';

import {
    readJson,
    sendError,
    sendJson,
    type TMockRequest,
    type TMockResponse,
} from './mock-http.ts';

const SESSION_ID = '30000000-0000-4000-8000-000000000050';
const saved = new Map<string, TSubmitRating>();
const closed = new Set<string>();

export function handleRating(
    request: TMockRequest,
    response: TMockResponse,
    pathname: string,
    token: string | undefined,
): boolean {
    if (!token?.startsWith('valid-rating') || !pathname.startsWith(`/sessions/${SESSION_ID}`))
        return false;
    const isCompleted = closed.has(token) || token.includes('completed');
    const canManage = !token.includes('member') && !token.includes('readonly');
    const canManageSession = canManage && !isCompleted;
    const own = saved.get(token);
    const version = 1 + Number(Boolean(own)) + Number(isCompleted);
    if (request.method === 'POST' && pathname.endsWith('/rating/close')) {
        readJson(request, (body) => {
            if (token.includes('closefailure'))
                sendError(response, 503, 'SERVICE_UNAVAILABLE', 'rating-close-failure');
            else if (token.includes('stale'))
                sendError(response, 409, 'CONFLICT', 'rating-stale', 'RATING_CHANGED');
            else if (!canManage) sendError(response, 403, 'FORBIDDEN', 'rating-role');
            else if (!closeRatingSchema.safeParse(body).success)
                sendError(response, 400, 'VALIDATION_FAILED', 'rating-input');
            else {
                closed.add(token);
                sendJson(response, 201, null);
            }
        });
    } else if (request.method === 'POST' && pathname.endsWith('/rating')) {
        readJson(request, (body) => {
            const parsed = submitRatingSchema.safeParse(body);
            if (token.includes('failure'))
                sendError(response, 503, 'SERVICE_UNAVAILABLE', 'rating-save-failure');
            else if (!parsed.success) sendError(response, 400, 'VALIDATION_FAILED', 'rating-input');
            else {
                saved.set(token, parsed.data);
                sendJson(response, 201, null);
            }
        });
    } else if (pathname.endsWith('/progress')) sendJson(response, 200, { version });
    else if (pathname.endsWith('/roster')) {
        const roster: ISessionRoster = {
            progressVersion: version,
            acceptedCount: 3,
            canJoin: false,
            canLeave: !isCompleted,
            canManage: canManageSession,
            canInvite: canManageSession,
            eligibleMembers: [],
            participants: ['Jordan', 'Casey', 'Morgan'].map((displayName, index) => ({
                id: `40000000-0000-4000-8000-00000000005${index}`,
                membershipId: `50000000-0000-4000-8000-00000000005${index}`,
                displayName,
                status: 'ACCEPTED',
                canRemove: canManageSession,
                invitation: null,
            })),
        };
        sendJson(response, 200, roster);
    } else {
        const session = buildRatingSession({
            token,
            own,
            isCompleted,
            canManageSession,
            version,
            canManage,
        });
        sendJson(response, 200, session);
    }
    return true;
}

function buildRating(
    token: string,
    own: TSubmitRating | undefined,
    isCompleted: boolean,
    canManage: boolean,
): TRating {
    const entries = [
        {
            id: '60000000-0000-4000-8000-000000000050',
            author: 'Casey',
            score: 8,
            comment: 'A memorable screening.',
            submittedAt: '2026-12-01T22:00:00.000Z',
        },
    ];
    if (token.includes('empty')) entries.length = 0;
    if (own)
        entries.push({
            id: '60000000-0000-4000-8000-000000000051',
            author: 'Jordan',
            ...own,
            comment: own.comment ?? '',
            submittedAt: '2026-12-01T22:01:00.000Z',
        });
    return {
        acceptedCount: 3,
        submittedCount: entries.length,
        receivedCount: entries.length,
        canSubmit: !isCompleted && !own && !token.includes('readonly'),
        canClose: !isCompleted && canManage,
        own: own
            ? { ...own, comment: own.comment ?? null, submittedAt: '2026-12-01T22:01:00.000Z' }
            : null,
        results:
            isCompleted && !token.includes('hidden')
                ? {
                      average: entries.length
                          ? entries.reduce((total, entry) => total + entry.score, 0) /
                            entries.length
                          : null,
                      entries,
                  }
                : null,
    };
}

function buildHistoricalSelection(token: string): TLiveSelectionOutcome {
    const winner = {
        id: '10000000-0000-4000-8000-000000000037',
        title: 'Selected film',
        year: 2026,
        genres: ['Drama'],
    };
    return {
        source: 'LIVE',
        winner,
        author: token.includes('hidden') ? null : 'Jordan',
        closedAt: '2026-12-01T19:00:00.000Z',
        closure: 'MANUAL',
        breakdown: token.includes('hidden')
            ? null
            : {
                  scaleMin: 0,
                  scaleMax: 10,
                  ballotCount: 2,
                  reason: 'TOTAL',
                  ranking: [
                      winner,
                      {
                          ...winner,
                          id: '10000000-0000-4000-8000-000000000038',
                          title: 'The rival nomination',
                      },
                  ].map((movie, index) => ({
                      id: `70000000-0000-4000-8000-00000000005${index}`,
                      movie,
                      author: 'Morgan',
                      total: index === 0 ? 18 : 12,
                      maximumCount: index === 0 ? 1 : 0,
                      supporterCount: 2,
                  })),
              },
    };
}

function buildRatingSession({
    token,
    own,
    isCompleted,
    canManageSession,
    version,
    canManage,
}: {
    token: string;
    own: TSubmitRating | undefined;
    isCompleted: boolean;
    canManageSession: boolean;
    version: number;
    canManage: boolean;
}): TSession {
    const rating = buildRating(token, own, isCompleted, canManage);
    return {
        id: SESSION_ID,
        clubId: '10000000-0000-4000-8000-000000000031',
        clubName: 'Midnight Society',
        type: token.includes('history') ? 'FULL_CYCLE' : 'PRE_SELECTED',
        phase: isCompleted ? 'COMPLETED' : 'RATING',
        movieId: '10000000-0000-4000-8000-000000000037',
        scheduledAt: '2026-12-01T20:00:00.000Z',
        location: 'Room A',
        topic: 'Noir night',
        notes: 'Bring snacks.',
        deadlineAt: null,
        version,
        phaseVersion: isCompleted ? 2 : 1,
        progressVersion: version,
        canManage: canManageSession,
        nominations: null,
        selection: null,
        selectionOutcome: token.includes('history') ? buildHistoricalSelection(token) : null,
        rating,
    };
}
