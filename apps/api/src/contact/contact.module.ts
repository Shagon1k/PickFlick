import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { ContactController } from './contact.controller.js';
import { ContactMessageRepository, PrismaContactMessageRepository } from './contact.repository.js';
import { ContactService } from './contact.service.js';

@Module({
    imports: [DatabaseModule],
    controllers: [ContactController],
    providers: [
        ContactService,
        { provide: ContactMessageRepository, useClass: PrismaContactMessageRepository },
    ],
})
export class ContactModule {}
