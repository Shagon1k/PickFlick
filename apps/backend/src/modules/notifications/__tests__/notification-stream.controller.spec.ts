import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../auth/auth.service.js';
import { NotificationStreamController } from '../notification-stream.controller.js';

describe('NotificationStreamController', () => {
    const user = { id: 'recipient', appRole: 'USER' as const, sessionId: 'session' };
    afterEach(() => vi.useRealTimers());

    it('should emit only a refresh signal after reauthorizing the original recipient', async () => {
        const auth = { resolveUser: vi.fn().mockResolvedValue(user) };
        const module = await Test.createTestingModule({
            controllers: [NotificationStreamController],
            providers: [{ provide: AuthService, useValue: auth }],
        }).compile();
        const controller = module.get(NotificationStreamController);
        const headers = { cookie: 'synthetic-test-cookie' };
        expect(await firstValueFrom(controller.stream({}, user, { headers }))).toEqual({
            data: { refresh: true },
        });
        expect(auth.resolveUser).toHaveBeenCalledWith(headers);
    });

    it('should terminate a revoked or changed recipient stream before emitting', async () => {
        for (const current of [null, { ...user, id: 'foreign' }]) {
            const auth = { resolveUser: vi.fn().mockResolvedValue(current) };
            const module = await Test.createTestingModule({
                controllers: [NotificationStreamController],
                providers: [{ provide: AuthService, useValue: auth }],
            }).compile();
            const controller = module.get(NotificationStreamController);
            await expect(
                firstValueFrom(controller.stream({}, user, { headers: {} })),
            ).rejects.toBeInstanceOf(UnauthorizedException);
        }
    });

    it('should recheck session authorization on an already open stream', async () => {
        vi.useFakeTimers();
        const auth = { resolveUser: vi.fn().mockResolvedValue(user) };
        const module = await Test.createTestingModule({
            controllers: [NotificationStreamController],
            providers: [{ provide: AuthService, useValue: auth }],
        }).compile();
        const controller = module.get(NotificationStreamController);
        const next = vi.fn();
        const error = vi.fn();
        const subscription = controller
            .stream({}, user, { headers: {} })
            .subscribe({ next, error });
        await vi.advanceTimersByTimeAsync(0);
        expect(next).toHaveBeenCalledTimes(1);
        auth.resolveUser.mockResolvedValue(null);
        await vi.advanceTimersByTimeAsync(5_000);
        expect(next).toHaveBeenCalledTimes(1);
        expect(error).toHaveBeenCalledWith(expect.any(UnauthorizedException));
        expect(subscription.closed).toBe(true);
        await module.close();
    });
});
