import { createHash } from 'node:crypto';

export function getAccountAvatarUrl(user: {
    image: string | null;
    avatarObjectKey: string | null;
    isAvatarRemoved: boolean;
}): string | null {
    if (user.isAvatarRemoved) return null;
    if (user.avatarObjectKey)
        return `/api/account/avatar?v=${createHash('sha256').update(user.avatarObjectKey).digest('hex')}`;
    return user.image ? '/api/account/avatar' : null;
}
