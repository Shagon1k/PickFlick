import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import type { TRuntimeEnvironment } from '@pickflick/config/environment';
import { createDatabaseAdapter, PrismaClient } from '@pickflick/database';

import { RUNTIME_ENVIRONMENT } from '../config/runtime.module.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
    constructor(@Inject(RUNTIME_ENVIRONMENT) environment: TRuntimeEnvironment) {
        super({ adapter: createDatabaseAdapter(environment.databaseUrl) });
    }

    async onModuleDestroy(): Promise<void> {
        await this.$disconnect();
    }
}
