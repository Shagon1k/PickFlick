import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { IDENTITY_AUTHORIZATION } from './authorization.types.js';
import { IdentityService } from './identity.service.js';

@Module({
    imports: [DatabaseModule],
    providers: [IdentityService, { provide: IDENTITY_AUTHORIZATION, useExisting: IdentityService }],
    exports: [IdentityService, IDENTITY_AUTHORIZATION],
})
export class IdentityModule {}
