import type {
    ISessionRoster,
    TSelection,
    TSelectionOutcome,
    TSession,
    TSubmitSelection,
} from '@pickflick/contracts';

import {
    readJson,
    sendError,
    sendJson,
    type TMockRequest,
    type TMockResponse,
} from './mock-http.ts';

const SESSION_ID = '30000000-0000-4000-8000-000000000045';
const closed = new Set<string>();
const states = new Map<string, TSubmitSelection | null>();

function buildSelection(token: string, ballot: TSubmitSelection | null): TSelection {
    return {
        scaleMin: token.includes('legacy') ? 1 : 0,
        scaleMax: token.includes('maximum') ? 10 : 3,
        acceptedCount: 3,
        submittedCount: ballot ? 2 : 1,
        canSubmit: !ballot && !token.includes('readonly'),
        submittedAt: ballot ? '2026-10-14T12:00:00.000Z' : null,
        nominations: token.includes('empty')
            ? []
            : [0, 1].map((index) => ({
                  id: `70000000-0000-4000-8000-00000000000${index}`,
                  movie: {
                      id: `20000000-0000-4000-8000-00000000000${index}`,
                      title:
                          index === 0
                              ? 'The Night of the Hunter'
                              : 'A very long nominated Movie title that wraps across several lines on mobile',
                      year: 1955 + index,
                  },
                  author: token.includes('anonymous') ? null : 'Jordan Member',
                  ownScore: ballot?.scores[index]?.score ?? null,
              })),
    };
}

export function handleSelection(
    request: TMockRequest,
    response: TMockResponse,
    pathname: string,
    token: string | undefined,
): boolean {
    if (!token?.startsWith('valid-selection') || !pathname.startsWith(`/sessions/${SESSION_ID}`))
        return false;
    const ballot = states.get(token) ?? null;
    const isClosed = closed.has(token) || token.includes('outcome');
    const ballotVersion = ballot ? 2 : 1;
    const version = isClosed ? 3 : ballotVersion;
    if (pathname.endsWith('/progress')) {
        sendJson(response, 200, { version });
        return true;
    }
    if (pathname.endsWith('/roster')) {
        const roster: ISessionRoster = {
            progressVersion: version,
            acceptedCount: 3,
            canJoin: false,
            canInvite: false,
            canManage: false,
            canLeave: false,
            participants: [],
            eligibleMembers: [],
        };
        sendJson(response, 200, roster);
        return true;
    }
    if (pathname.endsWith('/selection/close')) {
        readJson(request, () => {
            if (token.includes('failure'))
                sendError(response, 503, 'SERVICE_UNAVAILABLE', 'close-failure');
            else {
                closed.add(token);
                sendJson(response, 201, null);
            }
        });
        return true;
    }
    if (pathname.endsWith('/selection')) {
        readJson<TSubmitSelection>(request, (input) => {
            if (token.includes('failure')) {
                sendError(response, 503, 'SERVICE_UNAVAILABLE', 'selection-failure');
                return;
            }
            if (ballot) {
                sendError(response, 409, 'CONFLICT', 'selection-duplicate', 'ALREADY_SUBMITTED');
                return;
            }
            states.set(token, input);
            sendJson(response, 201, null);
        });
        return true;
    }
    const detail: TSession = {
        id: SESSION_ID,
        clubId: '10000000-0000-4000-8000-000000000031',
        clubName: 'Midnight Society',
        type: 'FULL_CYCLE',
        phase: isClosed ? 'WATCHING' : 'SELECTION',
        topic: 'Noir night',
        notes: 'A night at the cinema.',
        scheduledAt: '2026-12-01T20:00:00.000Z',
        location: 'Room A',
        deadlineAt: null,
        movieId: isClosed ? '20000000-0000-4000-8000-000000000000' : null,
        version: 1,
        phaseVersion: 2,
        progressVersion: version,
        nominations: null,
        selection: isClosed ? null : buildSelection(token, ballot),
        selectionOutcome: isClosed ? buildOutcome(token) : null,
        canEdit: token.includes('operator'),
        canCancel: false,
    };
    sendJson(response, 200, detail);
    return true;
}

function buildOutcome(token: string): TSelectionOutcome {
    const nominations = buildSelection(token, null).nominations;
    return {
        winner: nominations[0]!.movie,
        author: nominations[0]!.author,
        closedAt: '2026-10-15T12:00:00.000Z',
        closure: 'MANUAL',
        breakdown: token.includes('hidden')
            ? null
            : {
                  scaleMin: 0,
                  scaleMax: 3,
                  ballotCount: 0,
                  reason: 'NOMINATION_TIME',
                  ranking: nominations.map((row) => ({
                      id: row.id,
                      movie: row.movie,
                      author: row.author,
                      total: 0,
                      maximumCount: 0,
                      supporterCount: 0,
                  })),
              },
    };
}
