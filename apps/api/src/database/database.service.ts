import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import type { RuntimeEnvironment } from '@pickflick/config/environment';
import { createDatabaseClient } from '@pickflick/database';

import { RUNTIME_ENVIRONMENT } from '../runtime.tokens.js';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
    readonly client;

    constructor(@Inject(RUNTIME_ENVIRONMENT) environment: Pick<RuntimeEnvironment, 'databaseUrl'>) {
        this.client = createDatabaseClient(environment.databaseUrl);
    }

    async onModuleDestroy(): Promise<void> {
        await this.client.$disconnect();
    }
}
