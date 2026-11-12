import { getAccountAvatarUrl } from '../account-avatar-path.js';

describe('getAccountAvatarUrl', () => {
    it('should keep the provider projection and omit removed photos', () => {
        const user = { image: 'provider-photo', avatarObjectKey: null, isAvatarRemoved: false };
        expect(getAccountAvatarUrl(user)).toBe('/api/account/avatar');
        expect(getAccountAvatarUrl({ ...user, isAvatarRemoved: true })).toBeNull();
        expect(getAccountAvatarUrl({ ...user, image: null })).toBeNull();
    });
    it('should refresh replaced uploads without disclosing their keys', () => {
        const user = { image: null, avatarObjectKey: 'private-object-a', isAvatarRemoved: false };
        const first = getAccountAvatarUrl(user);
        expect(first).toMatch(/^\/api\/account\/avatar\?v=[0-9a-f]{64}$/u);
        expect(first).not.toContain(user.avatarObjectKey);
        expect(getAccountAvatarUrl({ ...user, avatarObjectKey: 'private-object-b' })).not.toBe(
            first,
        );
    });
});
