import type { IBillingHistory, IBillingOffer, IBillingSummary } from '@pickflick/contracts';

import {
    matchRoute,
    rejectMethod,
    sendError,
    sendJson,
    type TMockRequest,
    type TMockResponse,
} from './mock-http.ts';

const ROUTES = {
    '': 'GET',
    '/offer': 'GET',
    '/invoices': 'GET',
    '/checkout': 'POST',
    '/portal': 'POST',
} as const;
const failedReads = new Set<string>();

function summary(token: string): IBillingSummary {
    const hasSubscription = /billing-(?:pro|overdue|cancelled|pending)/u.test(token);
    let status: IBillingSummary['status'] = hasSubscription ? 'ACTIVE' : null;
    if (token.includes('overdue')) status = 'PAYMENT_OVERDUE';
    if (token.includes('pending')) status = 'PENDING';
    return {
        isEnabled: !token.includes('disabled'),
        plan: hasSubscription && status !== 'PENDING' ? 'PRO' : 'FREE',
        status,
        periodStart: hasSubscription ? '2026-11-25T12:00:00.000Z' : null,
        periodEnd: hasSubscription ? '2026-12-25T12:00:00.000Z' : null,
        paidThrough: hasSubscription && status !== 'PENDING' ? '2026-12-25T12:00:00.000Z' : null,
        cancelAtPeriodEnd: token.includes('cancelled'),
        hasCustomer: hasSubscription,
        hasCheckout: token.includes('pending'),
        usage: {
            administeredClubs: 1,
            clubs: [
                {
                    id: '10000000-0000-4000-8000-000000000031',
                    name: 'Friday Night Film Club',
                    members: 5,
                },
            ],
        },
    };
}

function buildHistory(request: TMockRequest, token: string): IBillingHistory {
    const cursor = new URL(request.url ?? '/', 'http://127.0.0.1').searchParams.get('cursor');
    const history: IBillingHistory = {
        invoices: summary(token).hasCustomer
            ? [
                  {
                      id: cursor ? 'invoice_previous' : 'invoice_latest',
                      amount: 605,
                      currency: 'eur',
                      status: 'paid',
                      createdAt: '2026-11-25T12:00:00.000Z',
                      documentUrl: 'https://invoice.stripe.com/test-fixture',
                  },
              ]
            : [],
        nextCursor: summary(token).hasCustomer && !cursor ? 'invoice_latest' : null,
    };
    return history;
}

export function handleBilling(
    request: TMockRequest,
    response: TMockResponse,
    pathname: string,
    token?: string,
): boolean {
    const route = matchRoute(pathname, '/billing', ROUTES);
    if (route === undefined) return false;
    if (rejectMethod(request, response, ROUTES[route])) return true;
    if (route === '/offer') {
        const offer: IBillingOffer = {
            isEnabled: Boolean(token?.includes('billing') && !token.includes('disabled')),
        };
        sendJson(response, 200, offer);
        return true;
    }
    if (!token?.startsWith('valid-')) {
        sendError(response, 401, 'UNAUTHORIZED', 'billing');
        return true;
    }
    if (token.includes('billing-retry') && !failedReads.has(token)) {
        failedReads.add(token);
        sendError(response, 503, 'SERVICE_UNAVAILABLE', 'billing');
        return true;
    }
    if (token.includes('billing-failure') && route !== '') {
        sendError(response, 503, 'SERVICE_UNAVAILABLE', 'billing');
        return true;
    }
    if (route === '') sendJson(response, 200, summary(token));
    else if (route === '/invoices') {
        sendJson(response, 200, buildHistory(request, token));
    } else
        sendJson(response, 201, {
            url: `http://127.0.0.1:41730/settings?tab=subscription&checkout=${route === '/checkout' ? 'returned' : 'portal'}`,
        });
    return true;
}
