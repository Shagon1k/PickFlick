import type { ServerResponse } from 'node:http';

import type { RuntimeEnvironment } from '@pickflick/config/environment';
import type { ApplicationLogger } from '@pickflick/observability';
import { describe, expect, it, vi } from 'vitest';

import { HealthController } from '../health.controller.js';
import { HealthService } from '../health.service.js';

describe('HealthController', () => {
    const logger = { warn: vi.fn() } as unknown as ApplicationLogger;

    it('keeps liveness independent from dependency readiness', async () => {
        const health = {
            liveness: () => ({ service: 'api' as const, status: 'alive' as const }),
            readiness: async () => ({
                status: 'not_ready' as const,
                checks: [{ name: 'database' as const, status: 'down' as const }],
            }),
        } as unknown as HealthService;
        const controller = new HealthController(health, logger);
        const response = { statusCode: 200 } as ServerResponse;

        expect(controller.liveness()).toEqual({ service: 'api', status: 'alive' });
        await expect(controller.readiness(response)).resolves.toEqual({
            status: 'not_ready',
            checks: [{ name: 'database', status: 'down' }],
        });
        expect(response.statusCode).toBe(503);
        expect(logger.warn).toHaveBeenCalledWith(
            { event: 'readiness.not_ready', checks: [{ name: 'database', status: 'down' }] },
            'API readiness has unavailable dependencies.',
        );
    });

    it('returns HTTP 200 when every dependency is ready', async () => {
        const health = {
            liveness: () => ({ service: 'api' as const, status: 'alive' as const }),
            readiness: async () => ({ status: 'ready' as const, checks: [] }),
        } as unknown as HealthService;
        const response = { statusCode: 200 } as ServerResponse;

        await new HealthController(health, logger).readiness(response);

        expect(response.statusCode).toBe(200);
    });

    it('exposes the built source revision through liveness', () => {
        const revision = 'a'.repeat(40);
        const health = new HealthService({ sourceRevision: revision } as RuntimeEnvironment);

        expect(new HealthController(health, logger).liveness()).toEqual({
            service: 'api',
            status: 'alive',
            revision,
        });
    });
});
