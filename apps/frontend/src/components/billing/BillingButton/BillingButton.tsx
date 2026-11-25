'use client';

import { useState, useTransition } from 'react';

import { openBillingPortal, startCheckout } from '#app/(product)/settings/billing-actions';
import Button from '#components/ui/Button/Button';
import ButtonLink from '#components/ui/Button/ButtonLink';
import StatusLine from '#components/ui/StatusLine/StatusLine';
import { getOfflineMessage } from '#lib/offline';

export default function BillingButton({
    action = 'checkout',
    children = 'Upgrade to Pro',
    isEnabled = true,
    isAnonymous = false,
    isDanger = false,
    isFullWidth = false,
}: {
    action?: 'checkout' | 'portal';
    children?: string;
    isEnabled?: boolean;
    isAnonymous?: boolean;
    isDanger?: boolean;
    isFullWidth?: boolean;
}) {
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState('');
    function handleClick() {
        const offline = getOfflineMessage();
        if (offline) return setMessage(offline);
        setMessage('');
        startTransition(async () => {
            try {
                const result = await (action === 'checkout'
                    ? startCheckout()
                    : openBillingPortal());
                if (!result.ok) return setMessage(result.message);
                window.location.assign(result.data.url);
            } catch {
                setMessage(
                    'The connection was interrupted. Refresh subscription status before trying again.',
                );
            }
        });
    }
    if (isAnonymous && isEnabled)
        return (
            <ButtonLink href="/login?returnTo=%2Fsettings%3Ftab%3Dsubscription">
                {children}
            </ButtonLink>
        );
    let variant: 'primary' | 'secondary' | 'secondary-danger' = 'primary';
    if (action === 'portal') variant = 'secondary';
    if (isDanger) variant = 'secondary-danger';
    return (
        <div>
            <Button
                disabled={!isEnabled}
                fullWidth={isFullWidth}
                loading={isPending}
                onClick={handleClick}
                variant={variant}
            >
                {children}
            </Button>
            {message ? <StatusLine message={message} /> : null}
        </div>
    );
}
