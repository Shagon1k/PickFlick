import { NOTIFICATION_EVENTS } from '@pickflick/contracts';

import { getNotificationPolicy } from '../notification-policy.js';

describe('getNotificationPolicy', () => {
    it.each(NOTIFICATION_EVENTS)(
        'should default %s to in-app and opted-out email except mandatory service notices',
        (event) => {
            expect(getNotificationPolicy(event)).toEqual({
                event,
                inApp: true,
                email: ['BILLING_SERVICE', 'CLUB_ADMIN_DELETED'].includes(event),
                mandatory: ['BILLING_SERVICE', 'CLUB_ADMIN_DELETED'].includes(event),
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
                        inApp:
                            ['BILLING_SERVICE', 'CLUB_ADMIN_DELETED'].includes(event) || hasInApp,
                        email:
                            ['BILLING_SERVICE', 'CLUB_ADMIN_DELETED'].includes(event) || hasEmail,
                        mandatory: ['BILLING_SERVICE', 'CLUB_ADMIN_DELETED'].includes(event),
                    });
                },
            );
        }
    }
});
