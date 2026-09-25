import type { DrainController, ApplicationLogger } from '@pickflick/observability';

import {
    CONTACT_DELIVERY_POLL_MILLISECONDS,
    CONTACT_RETRY_DELAYS_MILLISECONDS,
} from './contact-delivery.constants.js';
import { ContactDeliveryClaimLostError, ContactProviderError } from './contact-delivery.errors.js';
import type { ContactDeliveryStore, ContactSender } from './contact-delivery.types.js';

function retryAt(attemptCount: number, now: Date): Date | undefined {
    const delay = CONTACT_RETRY_DELAYS_MILLISECONDS[attemptCount - 1];
    return delay === undefined ? undefined : new Date(now.getTime() + delay);
}

export async function deliverNextContactMessage(
    store: ContactDeliveryStore,
    sender: ContactSender,
    logger: ApplicationLogger,
    now = new Date(),
): Promise<boolean> {
    const message = await store.claim(now);
    if (!message) {
        return false;
    }

    try {
        const providerMessageId = await sender.send(message);
        await store.complete(message.id, message.attemptCount, providerMessageId, now);
        logger.info(
            {
                event: 'contact.delivery.completed',
                contactMessageId: message.id,
                attemptCount: message.attemptCount,
            },
            'Contact message delivered.',
        );
    } catch (error) {
        if (error instanceof ContactDeliveryClaimLostError) {
            logger.warn(
                {
                    event: 'contact.delivery.claim_lost',
                    contactMessageId: message.id,
                    attemptCount: message.attemptCount,
                },
                'Contact delivery claim expired before completion.',
            );
            return true;
        }
        const providerError =
            error instanceof ContactProviderError
                ? error
                : new ContactProviderError('DELIVERY_FAILED', true);
        const nextAttemptAt = providerError.retryable
            ? retryAt(message.attemptCount, now)
            : undefined;
        try {
            await store.fail(message.id, message.attemptCount, providerError.code, nextAttemptAt);
        } catch (failureError) {
            if (failureError instanceof ContactDeliveryClaimLostError) {
                logger.warn(
                    {
                        event: 'contact.delivery.claim_lost',
                        contactMessageId: message.id,
                        attemptCount: message.attemptCount,
                    },
                    'Contact delivery claim expired before failure recording.',
                );
                return true;
            }
            throw failureError;
        }
        logger.error(
            {
                event: 'contact.delivery.failed',
                contactMessageId: message.id,
                attemptCount: message.attemptCount,
                errorCode: providerError.code,
                willRetry: Boolean(nextAttemptAt),
            },
            nextAttemptAt
                ? 'Contact delivery will retry.'
                : 'Contact delivery reached terminal failure.',
        );
    }
    return true;
}

function waitForPoll(signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
        if (signal.aborted) {
            resolve();
            return;
        }
        const onAbort = () => {
            clearTimeout(timer);
            resolve();
        };
        const timer = setTimeout(() => {
            signal.removeEventListener('abort', onAbort);
            resolve();
        }, CONTACT_DELIVERY_POLL_MILLISECONDS);
        signal.addEventListener('abort', onAbort, { once: true });
    });
}

export async function runContactDeliveryLoop(
    signal: AbortSignal,
    store: ContactDeliveryStore,
    sender: ContactSender,
    logger: ApplicationLogger,
    drain: DrainController,
): Promise<void> {
    while (!signal.aborted) {
        let processed = false;
        try {
            processed = await drain.run(() => deliverNextContactMessage(store, sender, logger));
        } catch (error) {
            if (signal.aborted || !drain.acceptingWork) {
                return;
            }
            // A transient store failure must not stop delivery; leases make the retried claim safe.
            logger.error(
                {
                    event: 'contact.delivery.iteration_failed',
                    errorName: error instanceof Error ? error.name : 'unknown',
                },
                'Contact delivery iteration failed; retrying after the poll interval.',
            );
        }
        if (!processed) {
            await waitForPoll(signal);
        }
    }
}
