import { randomUUID } from 'node:crypto';

import {
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import type {
    ICreatedInvitation,
    IManagedInvitation,
    IPendingClubInvitation,
    TCreateInvitation,
    TInvitationDecision,
    TInvitationPreview,
    TRespondInvitation,
} from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { digestInviteToken, inviteState, newInviteToken } from '../../../common/invite-token.js';
import { PrismaService } from '../../../database/prisma.service.js';
import {
    assertActive,
    findMembership,
    loadClubAccess,
    lockClub,
    recordAudit,
} from '../access/club-access.js';
import { getClubEntitlements } from '../access/club-tiers.js';
import { inspectInvitation } from './club-invitation-access.js';

const RECENT_INVITATIONS_LIMIT = 20;

async function findManagerMembership(
    transaction: Prisma.TransactionClient,
    userId: string,
    clubId: string,
) {
    const membership = await findMembership(transaction, userId, clubId);
    if (membership.role === 'MEMBER') {
        throw new ForbiddenException();
    }
    return membership;
}

@Injectable()
export class ClubInvitationsService {
    constructor(private readonly prisma: PrismaService) {}

    async create(
        userId: string,
        clubId: string,
        input: TCreateInvitation,
    ): Promise<ICreatedInvitation> {
        return this.prisma.$transaction(async (transaction) => {
            await lockClub(transaction, clubId);
            const membership = await findManagerMembership(transaction, userId, clubId);
            assertActive(membership);
            const { access, memberCount } = await loadClubAccess(transaction, membership.club);
            if (memberCount >= getClubEntitlements(clubId).memberLimit) {
                throw new ConflictException({ reason: 'MEMBER_LIMIT_REACHED' });
            }
            if (
                input.targetUserId &&
                !(await transaction.user.findFirst({
                    where: { id: input.targetUserId, status: 'ACTIVE' },
                    select: { id: true },
                }))
            ) {
                throw new ConflictException({ reason: 'INVITATION_TARGET_UNAVAILABLE' });
            }
            if (access.adminless) throw new ConflictException({ reason: 'CLUB_ADMIN_UNAVAILABLE' });
            const { token, tokenDigest, expiresAt } = newInviteToken();
            const invitation = await transaction.clubInvite.create({
                data: {
                    tokenDigest,
                    clubId,
                    inviterId: userId,
                    targetUserId: input.targetUserId,
                    expiresAt,
                },
            });
            await recordAudit(transaction, {
                clubId,
                actorUserId: userId,
                subjectUserId: userId,
                subjectMembershipId: membership.id,
                action: 'CLUB_INVITE_CREATED',
            });
            return { id: invitation.id, token, expiresAt: expiresAt.toISOString() };
        });
    }

    async list(userId: string, clubId: string): Promise<IManagedInvitation[]> {
        await findManagerMembership(this.prisma, userId, clubId);
        const recent = await this.prisma.clubInvite.findMany({
            where: { clubId },
            orderBy: { createdAt: 'desc' },
            take: RECENT_INVITATIONS_LIMIT,
            select: { id: true },
        });
        const invitations = await this.prisma.clubInvite.findMany({
            where: {
                clubId,
                OR: [
                    { id: { in: recent.map(({ id }) => id) } },
                    { revokedAt: null, respondedAt: null, expiresAt: { gt: new Date() } },
                ],
            },
            orderBy: { createdAt: 'desc' },
        });
        return invitations.map((invite) => ({
            id: invite.id,
            expiresAt: invite.expiresAt.toISOString(),
            state: inviteState(invite),
        }));
    }

    async revoke(userId: string, clubId: string, inviteId: string): Promise<void> {
        await this.prisma.$transaction(async (transaction) => {
            await lockClub(transaction, clubId);
            const membership = await findManagerMembership(transaction, userId, clubId);
            assertActive(membership);
            const invitation = await transaction.clubInvite.findFirst({
                where: { id: inviteId, clubId },
            });
            if (!invitation) throw new NotFoundException();
            if (invitation.revokedAt || invitation.respondedAt) return;
            await transaction.clubInvite.update({
                where: { id: inviteId },
                data: { revokedAt: new Date() },
            });
            await recordAudit(transaction, {
                clubId,
                actorUserId: userId,
                subjectUserId: userId,
                subjectMembershipId: membership.id,
                action: 'CLUB_INVITE_REVOKED',
            });
        });
    }

    async preview(userId: string, token: string): Promise<TInvitationPreview> {
        return this.prisma.$transaction(
            async (transaction) =>
                (await inspectInvitation(transaction, userId, digestInviteToken(token))).preview,
            { isolationLevel: 'RepeatableRead' },
        );
    }

    async pending(userId: string): Promise<IPendingClubInvitation[]> {
        return this.prisma.$transaction(
            async (transaction) => {
                const invitations = await transaction.clubInvite.findMany({
                    where: {
                        targetUserId: userId,
                        revokedAt: null,
                        respondedAt: null,
                        expiresAt: { gt: new Date() },
                    },
                    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                    select: { id: true, tokenDigest: true },
                });
                const pending: IPendingClubInvitation[] = [];
                for (const invitation of invitations) {
                    const { preview } = await inspectInvitation(
                        transaction,
                        userId,
                        invitation.tokenDigest,
                    );
                    if (preview.state === 'valid') {
                        pending.push({
                            id: invitation.id,
                            clubName: preview.clubName,
                            memberCount: preview.memberCount,
                            inviterName: preview.inviterName,
                            expiresAt: preview.expiresAt,
                        });
                    }
                }
                return pending;
            },
            { isolationLevel: 'RepeatableRead' },
        );
    }

    async respondPending(
        userId: string,
        inviteId: string,
        input: TInvitationDecision,
    ): Promise<TInvitationPreview> {
        const invitation = await this.prisma.clubInvite.findFirst({
            where: { id: inviteId, targetUserId: userId },
            select: { tokenDigest: true },
        });
        if (!invitation) return { state: 'invalid' };
        return this.respondDigest(userId, invitation.tokenDigest, input.decision);
    }

    async respond(userId: string, input: TRespondInvitation): Promise<TInvitationPreview> {
        return this.respondDigest(userId, digestInviteToken(input.token), input.decision);
    }

    private async respondDigest(
        userId: string,
        tokenDigest: string,
        decision: TInvitationDecision['decision'],
    ): Promise<TInvitationPreview> {
        return this.prisma.$transaction(async (transaction) => {
            const found = await transaction.clubInvite.findUnique({
                where: { tokenDigest },
                select: { clubId: true },
            });
            if (!found) return { state: 'invalid' };
            // The Club row serializes accepts across different links, revocation, and lifecycle writes.
            await lockClub(transaction, found.clubId);
            const { invitation, preview } = await inspectInvitation(
                transaction,
                userId,
                tokenDigest,
            );
            if (!invitation || preview.state !== 'valid') return preview;
            const isAccepted = decision === 'accept';
            if (isAccepted) {
                const membership = await transaction.membership.create({
                    data: {
                        id: randomUUID(),
                        clubId: invitation.clubId,
                        userId,
                        role: 'MEMBER',
                    },
                });
                await recordAudit(transaction, {
                    clubId: invitation.clubId,
                    actorUserId: userId,
                    subjectUserId: userId,
                    subjectMembershipId: membership.id,
                    action: 'MEMBERSHIP_JOINED',
                });
            }
            await transaction.clubInvite.update({
                where: { id: invitation.id },
                data: {
                    responderId: userId,
                    respondedAt: new Date(),
                    accepted: isAccepted,
                },
            });
            return isAccepted
                ? { state: 'accepted', clubId: invitation.clubId }
                : { state: 'declined' };
        });
    }
}
