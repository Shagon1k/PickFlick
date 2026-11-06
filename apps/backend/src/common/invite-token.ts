import { createHash, randomBytes } from 'node:crypto';

import type { IManagedInvitation } from '@pickflick/contracts';

const TOKEN_BYTES = 32;

/** Club invitations store only this digest; the raw token lives in the link. */
export function digestInviteToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

export function createInviteToken(lifetimeMs: number) {
    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    return {
        token,
        tokenDigest: digestInviteToken(token),
        expiresAt: new Date(Date.now() + lifetimeMs),
    };
}

export function getInviteState(invite: {
    revokedAt: Date | null;
    respondedAt: Date | null;
    accepted: boolean | null;
    expiresAt: Date;
}): IManagedInvitation['state'] {
    if (invite.revokedAt) return 'revoked';
    if (invite.respondedAt) return invite.accepted ? 'accepted' : 'declined';
    return invite.expiresAt <= new Date() ? 'expired' : 'pending';
}
