import { NOTIFICATION_EVENTS } from '@pickflick/contracts';

import { getNotificationPolicy } from '../notification-policy.js';

describe('getNotificationPolicy', () => {
    it.each(NOTIFICATION_EVENTS)(
        'should default %s to in-app and opted-out email except mandatory billing',
        (event) => {
            expect(getNotificationPolicy(event)).toEqual({
                event,
                inApp: true,
                email: event === 'BILLING_SERVICE',
                mandatory: event === 'BILLING_SERVICE',
            });
        },
    );
    for (const hasInApp of [false, true]) {
        for (const hasEmail of [false, true]) {
            it.each(NOTIFICATION_EVENTS)(
                `should apply every channel combination (${hasInApp}, ${hasEmail}) for %s`,
                (event) => {
                    expect(
                        getNotificationPolicy(event, { inApp: hasInApp, email: hasEmail }),
                    ).toEqual({
                        event,
                        inApp: event === 'BILLING_SERVICE' || hasInApp,
                        email: event === 'BILLING_SERVICE' || hasEmail,
                        mandatory: event === 'BILLING_SERVICE',
                    });
                },
            );
        }
    }
});
