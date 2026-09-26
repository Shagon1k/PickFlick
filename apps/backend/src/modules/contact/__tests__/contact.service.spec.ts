import { ServiceUnavailableException } from '@nestjs/common';
import type { TRuntimeEnvironment } from '@pickflick/config/environment';

import type { IEmailClient } from '../../email/email.types.js';
import { ContactService } from '../contact.service.js';

describe('ContactService', () => {
    const environment = { contact: { deliveryTo: 'hello@pick-flick.app' } } as TRuntimeEnvironment;

    it('should email the message to the Contact inbox with the sender as reply-to', async () => {
        const email: IEmailClient = { send: vi.fn(async () => undefined) };

        await new ContactService(environment, email).submit({
            message: 'Hi',
            email: 'a@b.example',
        });

        expect(email.send).toHaveBeenCalledWith(
            expect.objectContaining({
                to: 'hello@pick-flick.app',
                replyTo: 'a@b.example',
                text: expect.stringContaining('Hi'),
            }),
        );
    });

    it('should answer 503 when the email provider fails', async () => {
        const email: IEmailClient = { send: vi.fn(async () => Promise.reject(new Error('down'))) };

        await expect(
            new ContactService(environment, email).submit({ message: 'Hi' }),
        ).rejects.toThrow(ServiceUnavailableException);
    });
});
