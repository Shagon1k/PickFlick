import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

import { Module, type INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { NestFactory } from '@nestjs/core';
import type { ClubPolicyPermissions } from '@pickflick/contracts';
import { createLogger } from '@pickflick/observability';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ApiExceptionFilter } from '../../api-exception.filter.js';
import { AuthenticationGuard } from '../../identity/authorization.guard.js';
import {
    IDENTITY_AUTHORIZATION,
    SSE_AUTHORIZATION_RECHECK_MILLISECONDS,
    type IdentityAuthorizationBoundary,
} from '../../identity/authorization.types.js';
import { APPLICATION_LOGGER } from '../../runtime.tokens.js';
import type { ClubPolicySubject } from '../club-policy.js';
import type { PersistClubInput, StoredClubSummary } from '../club-onboarding.types.js';
import { ClubConflictError } from '../club.errors.js';
import { ClubManagementService } from '../club-management.service.js';
import { ClubRepository } from '../club.repository.js';
import { ClubTierResolver, StaticClubTierResolver } from '../club-tiers.js';
import { ClubsController } from '../clubs.controller.js';
import { ClubOnboardingService } from '../club-onboarding.service.js';
import { ClubPolicyService } from '../club-policy.service.js';

const clubId = '10000000-0000-4000-8000-000000000001';
const users = {
    admin: '00000000-0000-4000-8000-000000000001',
    moderator: '00000000-0000-4000-8000-000000000002',
    member: '00000000-0000-4000-8000-000000000003',
    appAdmin: '00000000-0000-4000-8000-000000000004',
    nonMember: '00000000-0000-4000-8000-000000000005',
} as const;

const roles = new Map<string, ClubPolicySubject>([
    [
        users.admin,
        { appRole: 'USER', clubRole: 'ADMIN', lifecycle: 'ACTIVE', userStatus: 'ACTIVE' },
    ],
    [
        users.moderator,
        { appRole: 'USER', clubRole: 'MODERATOR', lifecycle: 'ACTIVE', userStatus: 'ACTIVE' },
    ],
    [
        users.member,
        { appRole: 'USER', clubRole: 'MEMBER', lifecycle: 'ACTIVE', userStatus: 'ACTIVE' },
    ],
    [
        users.appAdmin,
        { appRole: 'APP_ADMIN', clubRole: null, lifecycle: null, userStatus: 'ACTIVE' },
    ],
    [users.nonMember, { appRole: 'USER', clubRole: null, lifecycle: null, userStatus: 'ACTIVE' }],
]);

class StubClubRepository extends ClubRepository {
    readonly created = new Map<string, StoredClubSummary[]>();

    async create(input: PersistClubInput, adminClubLimit: number): Promise<StoredClubSummary> {
        const current = this.created.get(input.creatorUserId) ?? [];
        if (current.length >= adminClubLimit) {
            throw new ClubConflictError('ADMIN_CLUB_LIMIT_REACHED', 'Admin Club limit reached.');
        }
        const club: StoredClubSummary = {
            id: input.clubId,
            name: input.name,
            ...(input.description ? { description: input.description } : {}),
            hasAvatar: false,
            lifecycle: 'ACTIVE',
            membershipRole: 'ADMIN',
            selectionScaleMin: input.selectionScaleMin,
            selectionScaleMax: input.selectionScaleMax,
        };
        this.created.set(input.creatorUserId, [...current, club]);
        return club;
    }

    async listForUser(userId: string): Promise<readonly StoredClubSummary[]> {
        return this.created.get(userId) ?? [];
    }

    async readPolicySubject(userId: string): Promise<ClubPolicySubject> {
        return (
            roles.get(userId) ?? {
                appRole: 'USER',
                clubRole: null,
                lifecycle: null,
                userStatus: 'ANONYMIZED',
            }
        );
    }
}

class StubIdentityAuthorization implements IdentityAuthorizationBoundary {
    async resolveSession(headers: Record<string, string | string[] | undefined>) {
        const token =
            typeof headers.authorization === 'string'
                ? headers.authorization.replace('Bearer ', '')
                : '';
        if (token === 'suspended') {
            return { authorized: false as const, reason: 'inactive_user' as const };
        }
        const userId = users[token as keyof typeof users];
        if (!userId) {
            return { authorized: false as const, reason: 'invalid_session' as const };
        }
        return {
            authorized: true as const,
            principal: {
                appRole: token === 'appAdmin' ? ('APP_ADMIN' as const) : ('USER' as const),
                sessionId: `${token}-session`,
                userId,
            },
        };
    }
}

const logger = createLogger({ environment: 'test', service: 'api' });

@Module({
    controllers: [ClubsController],
    providers: [
        ClubOnboardingService,
        ClubPolicyService,
        { provide: ClubManagementService, useValue: {} },
        { provide: ClubRepository, useClass: StubClubRepository },
        { provide: ClubTierResolver, useClass: StaticClubTierResolver },
        { provide: IDENTITY_AUTHORIZATION, useClass: StubIdentityAuthorization },
        { provide: APPLICATION_LOGGER, useValue: logger },
        { provide: SSE_AUTHORIZATION_RECHECK_MILLISECONDS, useValue: 30_000 },
        { provide: APP_GUARD, useClass: AuthenticationGuard },
    ],
})
class TestModule {}

describe('Club policy HTTP boundary', () => {
    let app: INestApplication;
    let baseUrl: string;

    beforeAll(async () => {
        app = await NestFactory.create(TestModule, { logger: false });
        app.useGlobalFilters(new ApiExceptionFilter(logger));
        await app.listen(0, '127.0.0.1');
        const address = (app.getHttpServer() as Server).address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
    });

    afterAll(async () => app.close());

    async function policy(token: string, extraHeaders: Record<string, string> = {}) {
        return fetch(`${baseUrl}/clubs/${clubId}/policy`, {
            headers: { authorization: `Bearer ${token}`, ...extraHeaders },
        });
    }

    async function clubs(token: string, init?: RequestInit) {
        return fetch(`${baseUrl}/clubs`, {
            ...init,
            headers: { authorization: `Bearer ${token}`, ...init?.headers },
        });
    }

    it('creates and lists a Free Club with the authenticated User as Admin', async () => {
        const response = await clubs('nonMember', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                name: '  Midnight Society  ',
                description: '  Noir, classics, and arguments.  ',
                selectionScaleMin: 0,
                selectionScaleMax: 7,
            }),
        });
        expect(response.status).toBe(201);
        await expect(response.json()).resolves.toMatchObject({
            club: {
                name: 'Midnight Society',
                description: 'Noir, classics, and arguments.',
                lifecycle: 'ACTIVE',
                membershipRole: 'ADMIN',
                selectionScaleMin: 0,
                selectionScaleMax: 7,
                tier: 'FREE',
            },
        });

        const listResponse = await clubs('nonMember');
        expect(listResponse.status).toBe(200);
        await expect(listResponse.json()).resolves.toMatchObject({
            clubs: [{ name: 'Midnight Society', membershipRole: 'ADMIN', tier: 'FREE' }],
        });

        const limitedResponse = await clubs('nonMember', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                name: 'Second Club',
                selectionScaleMin: 1,
                selectionScaleMax: 5,
            }),
        });
        expect(limitedResponse.status).toBe(409);
        await expect(limitedResponse.json()).resolves.toMatchObject({
            error: { code: 'CONFLICT', reason: 'ADMIN_CLUB_LIMIT_REACHED' },
        });
    });

    it.each([
        { name: '', selectionScaleMin: 0, selectionScaleMax: 5 },
        { name: 'No', selectionScaleMin: 0, selectionScaleMax: 5 },
        { name: 'Valid Club', selectionScaleMin: 2, selectionScaleMax: 5 },
        { name: 'Valid Club', selectionScaleMin: 1, selectionScaleMax: 1 },
        { name: 'Valid Club', selectionScaleMin: 0, selectionScaleMax: 11 },
        { name: 'Valid Club', selectionScaleMin: 0, selectionScaleMax: 5, forgedRole: 'ADMIN' },
    ])('rejects invalid Club creation input %#', async (payload) => {
        const response = await clubs('member', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
        });
        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({
            error: { code: 'VALIDATION_FAILED' },
        });
    });

    it('rejects non-JSON and unauthenticated Club creation', async () => {
        expect((await clubs('member', { method: 'POST', body: 'name=Club' })).status).toBe(415);
        expect(
            (
                await clubs('forged', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                        name: 'Valid Club',
                        selectionScaleMin: 0,
                        selectionScaleMax: 5,
                    }),
                })
            ).status,
        ).toBe(401);
    });

    it.each([
        ['admin', 'ADMIN', { manageRoles: true, manageSessions: true, participate: true }],
        ['moderator', 'MODERATOR', { manageRoles: false, manageSessions: true, participate: true }],
        ['member', 'MEMBER', { manageRoles: false, manageSessions: false, participate: true }],
    ] as const)(
        'returns the authoritative %s projection',
        async (token, membershipRole, expected) => {
            const response = await policy(token);
            expect(response.status).toBe(200);
            const body = (await response.json()) as {
                membershipRole: string;
                permissions: ClubPolicyPermissions;
                entitlements: { tier: string; memberLimit: number };
            };
            expect(body.membershipRole).toBe(membershipRole);
            expect(body.permissions).toMatchObject(expected);
            expect(body.entitlements).toMatchObject({ tier: 'PRO', memberLimit: 16 });
        },
    );

    it.each([
        ['appAdmin', 403, 'FORBIDDEN'],
        ['nonMember', 403, 'FORBIDDEN'],
        ['suspended', 401, 'UNAUTHORIZED'],
        ['forged', 401, 'UNAUTHORIZED'],
    ] as const)(
        'denies the %s request without disclosing Club data',
        async (token, status, code) => {
            const response = await policy(token);
            expect(response.status).toBe(status);
            await expect(response.json()).resolves.toMatchObject({ error: { code } });
        },
    );

    it('ignores caller-supplied Club and App role headers', async () => {
        const response = await policy('member', {
            'x-club-role': 'ADMIN',
            'x-app-role': 'APP_ADMIN',
        });
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            membershipRole: 'MEMBER',
            permissions: { manageRoles: false, manageSessions: false },
        });
    });
});
