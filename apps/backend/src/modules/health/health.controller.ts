import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { ILivenessReport, IReadinessReport } from '@pickflick/contracts';
import type { Response } from 'express';

import { Public } from '../auth/decorators/public.decorator.js';
import { HealthService } from './health.service.js';

@Controller('health')
@Public()
@SkipThrottle()
export class HealthController {
    constructor(private readonly healthService: HealthService) {}

    @Get('live')
    liveness(): ILivenessReport {
        return this.healthService.liveness();
    }

    @Get('ready')
    async readiness(@Res({ passthrough: true }) response: Response): Promise<IReadinessReport> {
        const report = await this.healthService.readiness();
        if (report.status === 'not_ready') {
            response.status(HttpStatus.SERVICE_UNAVAILABLE);
        }
        return report;
    }
}
