import {
    ACCOUNT_AVATAR_MAX_BYTES,
    appearanceSchema,
    type IAccountProfile,
} from '@pickflick/contracts';

import { createUser, type ITestApi, startTestApi } from '../../../testing/integration.js';
import { removeUsers } from '../../../testing/remove-users.js';
import type { AvatarCleanupService } from '../avatar-cleanup.service.js';

const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
);

describe('AccountController', () => {
    let api: ITestApi;
    let owner: string;
    let other: string;
    let cleanup: AvatarCleanupService;
    const get = async (userId: string) =>
        (await (await api.request('/account', { userId })).json()) as IAccountProfile;
    const upload = (userId: string, body = PNG, contentType = 'image/png') =>
        api.request('/account/avatar', {
            userId,
            method: 'PUT',
            body: new Uint8Array(body),
            headers: { 'content-type': contentType },
        });
    beforeAll(async () => {
        api = await startTestApi();
        [owner, other] = await Promise.all([createUser(api.prisma), createUser(api.prisma)]);
        cleanup = api.avatarCleanup;
    });
    afterAll(async () => {
        await api.request('/account/avatar', { userId: owner, method: 'DELETE' });
        await removeUsers(api.prisma, [owner, other]);
        await api.close();
    });
    it('should reject anonymous and identifier-bearing requests', async () => {
        for (const path of ['/account', '/account/avatar']) await api.expectStatus(401, path);
        await api.expectStatus(400, `/account?userId=${other}`, { userId: owner });
        await api.expectStatus(400, `/account/avatar?userId=${other}`, { userId: owner });
        await api.expectStatus(404, `/account/${other}`, { userId: owner });
    });
    it('should update only the caller profile without exposing provider secrets or keys', async () => {
        await api.expectStatus(200, '/account/profile', {
            userId: owner,
            method: 'PUT',
            json: { displayName: '  New name  ', locale: 'en' },
        });
        expect((await get(owner)).displayName).toBe('New name');
        expect((await get(other)).displayName).toBe('Test User');
        await api.expectStatus(400, '/account/profile', {
            userId: owner,
            method: 'PUT',
            json: { displayName: 'Name', locale: 'en', userId: other },
        });
        expect(Object.keys(await get(owner)).sort((a, b) => a.localeCompare(b))).toEqual([
            'appearance',
            'avatarUrl',
            'displayName',
            'email',
            'id',
            'locale',
            'providers',
        ]);
    });
    it('should persist appearance independently of other accounts and shared history', async () => {
        const before = await get(other);
        const appearance = appearanceSchema.parse({
            monochrome: true,
            colorReveal: false,
            quietMode: true,
            listSpacing: 'compact',
            hiddenColumns: ['year', 'rank'],
        });
        await api.expectStatus(200, '/account/appearance', {
            userId: owner,
            method: 'PUT',
            json: appearance,
        });
        expect((await get(owner)).appearance).toEqual(appearance);
        expect(await get(other)).toEqual(before);
        await api.expectStatus(400, '/account/appearance', {
            userId: owner,
            method: 'PUT',
            json: { ...appearance, hiddenColumns: ['film'] },
        });
    });
    it('should reject mismatched MIME, unsupported content and oversized uploads before storage', async () => {
        expect((await upload(owner, PNG, 'image/jpeg')).status).toBe(400);
        expect((await upload(owner, Buffer.from('<svg/>'), 'image/svg+xml')).status).toBe(400);
        expect((await upload(owner, Buffer.alloc(ACCOUNT_AVATAR_MAX_BYTES + 1))).status).toBe(400);
        expect(api.storage.objects.size).toBe(0);
    });
    it('should isolate private avatar reads, replace and remove objects, and suppress the provider fallback', async () => {
        expect((await upload(owner)).status).toBe(204);
        const firstKey = (await api.prisma.user.findUniqueOrThrow({ where: { id: owner } }))
            .avatarObjectKey!;
        const response = await api.expectStatus(200, '/account/avatar', { userId: owner });
        expect(response.headers.get('cache-control')).toBe('private, no-store');
        expect(response.headers.get('content-type')).toBe('image/webp');
        expect(Buffer.from(await response.arrayBuffer())).toEqual(
            api.storage.objects.get(firstKey)?.body,
        );
        await api.expectStatus(404, '/account/avatar', { userId: other });
        await api.expectStatus(404, `/account/avatar/${firstKey}`, { userId: other });
        expect((await upload(owner)).status).toBe(204);
        expect(api.storage.objects.has(firstKey)).toBe(false);
        expect(
            await api.prisma.accountAvatarObject.findUnique({ where: { key: firstKey } }),
        ).toBeNull();
        await api.prisma.user.update({
            where: { id: owner },
            data: { image: 'https://lh3.googleusercontent.com/photo' },
        });
        await api.expectStatus(204, '/account/avatar', { userId: owner, method: 'DELETE' });
        expect((await get(owner)).avatarUrl).toBeNull();
        expect(api.storage.objects.size).toBe(0);
        await api.expectStatus(404, '/account/avatar', { userId: owner });
    });
    it('should clean a failed database attachment and retain failed cleanup for a later sweep', async () => {
        expect((await upload('00000000-0000-4000-8000-000000000000')).status).toBe(404);
        expect(api.storage.objects.size).toBe(0);
        const key = 'account-avatars/abandoned.png';
        await api.prisma.accountAvatarObject.create({
            data: { key, createdAt: new Date('2020-01-01') },
        });
        await api.storage.put(key, PNG, 'image/png');
        const deletion = vi
            .spyOn(api.storage, 'delete')
            .mockRejectedValueOnce(new Error('storage unavailable'));
        await cleanup.sweep();
        expect(await api.prisma.accountAvatarObject.findUnique({ where: { key } })).not.toBeNull();
        await cleanup.sweep();
        expect(await api.prisma.accountAvatarObject.findUnique({ where: { key } })).toBeNull();
        expect(api.storage.objects.has(key)).toBe(false);
        deletion.mockRestore();
    });
    it('should keep exactly the current object after concurrent replacements', async () => {
        const responses = await Promise.all([upload(owner), upload(owner)]);
        expect(responses.map(({ status }) => status)).toEqual([204, 204]);
        const user = await api.prisma.user.findUniqueOrThrow({ where: { id: owner } });
        expect([...api.storage.objects.keys()]).toEqual([user.avatarObjectKey]);
        await cleanup.sweep();
        expect(api.storage.objects.has(user.avatarObjectKey!)).toBe(true);
    });
});
