import { Module } from '@nestjs/common';

import { EmailModule } from '../email/email.module.js';
import { ContactController } from './contact.controller.js';
import { ContactService } from './contact.service.js';

@Module({
    imports: [EmailModule],
    controllers: [ContactController],
    providers: [ContactService],
})
export class ContactModule {}
