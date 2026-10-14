import { createHash, randomBytes } from 'node:crypto';

import type { IManagedInvitation } from '@pickflick/contracts';

const TOKEN_BYTES = 32;

const INVITE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

/** Club and Session invitations store only this digest; the raw token lives in the link. */
export function digestInviteToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

/** A fresh link token, its stored digest, and the seven-day expiry shared by all invitations. */
export function newInviteToken() {
    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    return {
        token,
        tokenDigest: digestInviteToken(token),
        expiresAt: new Date(Date.now() + INVITE_LIFETIME_MS),
    };
}

export function inviteState(invite: {
    revokedAt: Date | null;
    respondedAt: Date | null;
    accepted: boolean | null;
    expiresAt: Date;
}): IManagedInvitation['state'] {
    if (invite.revokedAt) return 'revoked';
    if (invite.respondedAt) return invite.accepted ? 'accepted' : 'declined';
    return invite.expiresAt <= new Date() ? 'expired' : 'pending';
}
