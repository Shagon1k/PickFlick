import {
    Inject,
    Injectable,
    Logger,
    type OnModuleDestroy,
    type OnModuleInit,
} from '@nestjs/common';
import type { TRuntimeEnvironment } from '@pickflick/config/environment';
import { createClient } from 'redis';
import { filter, map, Subject } from 'rxjs';
import { z } from 'zod';

import { RUNTIME_ENVIRONMENT } from '../../config/runtime.module.js';

const PUBLISH_TIMEOUT_MS = 500;
const CONNECT_TIMEOUT_MS = 1000;
const MAX_PENDING_SIGNALS = 1000;

const recipientSchema = z.uuid();

/** Redis contains only recipient IDs; authorized REST projections supply all inbox content. */
@Injectable()
export class NotificationSignals implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(NotificationSignals.name);
    private readonly publisher;
    private readonly subscriber;
    private readonly recipients = new Subject<string>();
    private readonly channel: string;

    constructor(
        @Inject(RUNTIME_ENVIRONMENT)
        environment: Pick<TRuntimeEnvironment, 'redisUrl' | 'appEnvironment'>,
    ) {
        this.channel = `pickflick:${environment.appEnvironment}:notifications:refresh`;
        this.publisher = createClient({
            url: environment.redisUrl,
            disableOfflineQueue: true,
            commandsQueueMaxLength: MAX_PENDING_SIGNALS,
            commandOptions: { timeout: PUBLISH_TIMEOUT_MS },
            socket: { connectTimeout: CONNECT_TIMEOUT_MS },
        });
        this.subscriber = this.publisher.duplicate();
        for (const client of [this.publisher, this.subscriber]) {
            client.on('error', () =>
                this.logger.warn('Notification Redis connection unavailable.'),
            );
        }
    }

    onModuleInit(): void {
        void this.publisher
            .connect()
            .catch(() => this.logger.warn('Notification publisher stopped.'));
        void this.subscriber
            .connect()
            .then(() =>
                this.subscriber.subscribe(this.channel, (message) => {
                    const recipient = recipientSchema.safeParse(message);
                    if (recipient.success) this.recipients.next(recipient.data);
                }),
            )
            .catch(() => this.logger.warn('Notification subscriber stopped.'));
    }

    forRecipient(recipientId: string) {
        return this.recipients.pipe(
            filter((id) => id === recipientId),
            map(() => ({ data: { refresh: true } })),
        );
    }

    async publish(recipients: Iterable<string>): Promise<void> {
        if (!this.publisher.isReady) {
            if ([...recipients].length)
                this.logger.warn('Notification refresh skipped while Redis is unavailable.');
            return;
        }
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            // The client's command timeout ends once bytes are sent, so bound the reply wait too.
            await Promise.race([
                Promise.all([...recipients].map((id) => this.publisher.publish(this.channel, id))),
                new Promise<never>((_resolve, reject) => {
                    timer = setTimeout(
                        () => reject(new Error('Notification publish timed out.')),
                        PUBLISH_TIMEOUT_MS,
                    );
                }),
            ]);
        } catch {
            this.logger.warn('Notification refresh publish failed; clients will reconcile.');
        } finally {
            clearTimeout(timer);
        }
    }

    onModuleDestroy(): void {
        for (const client of [this.publisher, this.subscriber]) {
            if (client.isOpen) client.destroy();
        }
        this.recipients.complete();
    }
}
