import { NOTIFICATION_EVENTS } from '@pickflick/contracts';

import { renderNotificationEmail } from '../email-template.js';

describe('renderNotificationEmail', () => {
    const input = {
        href: '/clubs/00000000-0000-4000-8000-000000000000',
        createdAt: '2026-10-28T12:00:00Z',
        baseUrl: 'https://uat.pick-flick.app',
    };
    it.each(NOTIFICATION_EVENTS)(
        'should render the selected Card with text and safe canonical actions for %s',
        (event) => {
            const email = renderNotificationEmail({ ...input, event });
            expect(email.subject).toContain('PickFlick');
            expect(email.text.includes(`https://uat.pick-flick.app${input.href}`)).toBe(
                !['MEMBERSHIP_LEFT', 'MEMBERSHIP_REMOVED'].includes(event),
            );
            expect(email.html).toContain('<html lang="en">');
            expect(email.html).toContain('role="presentation"');
            expect(email.html).not.toMatch(/<script|<img|invitation|token=/u);
            expect(email.text.includes('You opted in')).toBe(event !== 'BILLING_SERVICE');
            expect(email.html.includes('Notification settings')).toBe(event !== 'BILLING_SERVICE');
        },
    );
    it('should remove event details and target actions when access is unavailable', () => {
        const email = renderNotificationEmail({
            ...input,
            event: 'ACHIEVEMENT_EARNED',
            href: null,
        });
        expect(email.subject).toContain('no longer available');
        expect(email.html).not.toMatch(/achievement|Open Session|\/clubs\//u);
    });
    it.each(['MEMBERSHIP_LEFT', 'MEMBERSHIP_REMOVED'] as const)(
        'should omit the entity action for %s even when access has since returned',
        (event) => {
            const email = renderNotificationEmail({ ...input, event });
            expect(email.html).not.toContain(input.href);
            expect(email.text).not.toContain(input.href);
            expect(email.html).toContain('Your');
        },
    );

    it('should encode a canonical link for the HTML attribute context', () => {
        const email = renderNotificationEmail({
            ...input,
            event: 'CLUB_ARCHIVED',
            href: '/settings?a=1&b=2',
        });
        expect(email.html).toContain('/settings?a=1&amp;b=2');
        expect(email.text).toContain('/settings?a=1&b=2');
    });
});
