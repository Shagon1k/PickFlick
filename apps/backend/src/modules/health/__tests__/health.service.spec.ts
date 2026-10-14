import type { TRuntimeEnvironment } from '@pickflick/config/environment';

import type { PrismaService } from '../../../database/prisma.service.js';
import type { StorageService } from '../../storage/storage.service.js';
import { HealthService } from '../health.service.js';

describe('HealthService', () => {
    const environment = { sourceRevision: 'a'.repeat(40) } as TRuntimeEnvironment;

    function service(isStorageUp: boolean): HealthService {
        const prisma = {
            $queryRaw: vi.fn(async () => [{ '?column?': 1 }]),
        } as unknown as PrismaService;
        const storage = {
            ping: vi.fn(async () => (isStorageUp ? undefined : Promise.reject(new Error('down')))),
        } as unknown as StorageService;
        return new HealthService(environment, prisma, storage);
    }

    it('should report the running revision', () => {
        expect(service(true).liveness()).toEqual({ status: 'alive', revision: 'a'.repeat(40) });
    });

    it('should be ready only when every dependency answers', async () => {
        await expect(service(true).readiness()).resolves.toMatchObject({ status: 'ready' });
        await expect(service(false).readiness()).resolves.toEqual({
            status: 'not_ready',
            checks: [
                { name: 'database', status: 'up' },
                { name: 'objectStorage', status: 'down' },
            ],
        });
    });
});
