import { createHash, randomBytes, randomUUID } from 'node:crypto';

import {
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import type {
    ICreatedInvitation,
    IManagedInvitation,
    TCreateInvitation,
    TInvitationPreview,
    TRespondInvitation,
} from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { PrismaService } from '../../database/prisma.service.js';
import { assertActive, findMembership, recordAudit } from './club-access.js';
import { clubEntitlements } from './club-tiers.js';

const digest = (token: string) => createHash('sha256').update(token).digest('hex');

async function lockClub(transaction: Prisma.TransactionClient, clubId: string) {
    await transaction.$queryRaw`SELECT id FROM "Club" WHERE id = ${clubId}::uuid FOR UPDATE`;
}

async function manager(transaction: Prisma.TransactionClient, userId: string, clubId: string) {
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
            const membership = await manager(transaction, userId, clubId);
            assertActive(membership);
            const count = await transaction.membership.count({
                where: { clubId, status: 'ACTIVE' },
            });
            if (count >= clubEntitlements(clubId).memberLimit) {
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
            const admin = await transaction.membership.findFirst({
                where: { clubId, role: 'ADMIN', status: 'ACTIVE' },
                select: { id: true },
            });
            if (!admin) throw new ConflictException({ reason: 'CLUB_ADMIN_UNAVAILABLE' });
            const token = randomBytes(32).toString('base64url');
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            const invitation = await transaction.clubInvite.create({
                data: {
                    tokenDigest: digest(token),
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
        await manager(this.prisma, userId, clubId);
        const invitations = await this.prisma.clubInvite.findMany({
            where: { clubId },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });
        return invitations.map((invite) => {
            let state: IManagedInvitation['state'] = 'pending';
            if (invite.revokedAt) state = 'revoked';
            else if (invite.respondedAt) state = invite.accepted ? 'accepted' : 'declined';
            else if (invite.expiresAt <= new Date()) state = 'expired';
            return { id: invite.id, expiresAt: invite.expiresAt.toISOString(), state };
        });
    }

    async revoke(userId: string, clubId: string, inviteId: string): Promise<void> {
        await this.prisma.$transaction(async (transaction) => {
            await lockClub(transaction, clubId);
            const membership = await manager(transaction, userId, clubId);
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
            async (transaction) => (await this.inspect(transaction, userId, token)).preview,
            { isolationLevel: 'RepeatableRead' },
        );
    }

    async respond(userId: string, input: TRespondInvitation): Promise<TInvitationPreview> {
        return this.prisma.$transaction(async (transaction) => {
            const found = await transaction.clubInvite.findUnique({
                where: { tokenDigest: digest(input.token) },
                select: { clubId: true },
            });
            if (!found) return { state: 'invalid' };
            // The Club row serializes accepts across different links, revocation, and lifecycle writes.
            await lockClub(transaction, found.clubId);
            const { invitation, preview } = await this.inspect(transaction, userId, input.token);
            if (!invitation || preview.state !== 'valid') return preview;
            const accepted = input.decision === 'accept';
            if (accepted) {
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
                    accepted,
                },
            });
            return accepted
                ? { state: 'accepted', clubId: invitation.clubId }
                : { state: 'declined' };
        });
    }

    private async inspect(transaction: Prisma.TransactionClient, userId: string, token: string) {
        const invitation = await transaction.clubInvite.findUnique({
            where: { tokenDigest: digest(token) },
            include: { club: true, inviter: { select: { displayName: true } } },
        });
        const result = (preview: TInvitationPreview) => ({ invitation, preview });
        if (!invitation || (invitation.targetUserId && invitation.targetUserId !== userId)) {
            return result({ state: 'invalid' });
        }
        if (invitation.club.deletedAt) return result({ state: 'invalid' });
        if (invitation.revokedAt) return result({ state: 'revoked' });
        if (invitation.expiresAt <= new Date()) return result({ state: 'expired' });
        const membership = await transaction.membership.findFirst({
            where: { clubId: invitation.clubId, userId, status: 'ACTIVE' },
            select: { id: true },
        });
        if (membership) return result({ state: 'already-member', clubId: invitation.clubId });
        if (invitation.respondedAt) {
            return result({
                state:
                    invitation.responderId === userId && !invitation.accepted
                        ? 'declined'
                        : 'invalid',
            });
        }
        if (invitation.club.lifecycle !== 'ACTIVE') return result({ state: 'unavailable' });
        const memberCount = await transaction.membership.count({
            where: { clubId: invitation.clubId, status: 'ACTIVE' },
        });
        const admin = await transaction.membership.findFirst({
            where: { clubId: invitation.clubId, role: 'ADMIN', status: 'ACTIVE' },
            select: { id: true },
        });
        if (!admin) return result({ state: 'unavailable' });
        if (memberCount >= clubEntitlements(invitation.clubId).memberLimit)
            return result({ state: 'over-limit' });
        return result({
            state: 'valid',
            clubName: invitation.club.name,
            memberCount,
            inviterName: invitation.inviter.displayName,
            expiresAt: invitation.expiresAt.toISOString(),
        });
    }
}
