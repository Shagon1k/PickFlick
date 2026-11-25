'use client';

import { type IBillingSummary } from '@pickflick/contracts';
import { useState, useTransition } from 'react';

import BillingButton from '#components/billing/BillingButton/BillingButton';
import Alert from '#components/ui/Alert/Alert';
import Button from '#components/ui/Button/Button';
import { getOfflineMessage } from '#lib/offline';

import { refreshSubscription } from '../../billing-actions';
import BillingHistory from './BillingHistory';
import CurrentPlan from './CurrentPlan';
import styles from './SubscriptionPanel.module.scss';
import SubscriptionUsage from './SubscriptionUsage';

function getNotice(summary: IBillingSummary, checkout?: string) {
    if (
        summary.status === 'PAYMENT_OVERDUE' ||
        summary.status === 'PAUSED' ||
        summary.status === 'PENDING'
    )
        return 'Payment needs attention. Check the billing portal for the next step. Paid access is shown only for a confirmed paid period.';
    if (checkout === 'returned' && summary.plan !== 'PRO')
        return 'Payment confirmation pending. Your return from checkout does not confirm payment. Refresh subscription status to check the provider.';
    if (checkout === 'cancelled')
        return 'Checkout was closed. No plan change is assumed. Refresh to check whether a payment completed.';
    return null;
}

export default function SubscriptionPanel({
    initial,
    checkout,
}: {
    initial: IBillingSummary | null;
    checkout?: string;
}) {
    const [summary, setSummary] = useState(initial);
    const [historyVersion, setHistoryVersion] = useState(0);
    const [message, setMessage] = useState('');
    const [isPending, startTransition] = useTransition();
    function handleRefresh() {
        const offline = getOfflineMessage();
        if (offline) return setMessage(offline);
        setMessage('');
        startTransition(async () => {
            try {
                const result = await refreshSubscription();
                if (!result.ok) return setMessage(result.message);
                setSummary(result.data);
                setHistoryVersion((previous) => previous + 1);
            } catch {
                setMessage('Subscription status could not be refreshed. Try again.');
            }
        });
    }
    if (!summary)
        return (
            <section aria-label="Subscription unavailable" className={styles.card}>
                <h2>Subscription unavailable</h2>
                <p>Your plan could not be confirmed. Refresh before starting another purchase.</p>
                <Button loading={isPending} onClick={handleRefresh}>
                    Refresh subscription status
                </Button>
                {message ? <Alert tone="danger">{message}</Alert> : null}
            </section>
        );
    const notice = getNotice(summary, checkout);
    return (
        <div className={styles.subscription}>
            {message ? <Alert tone="danger">{message}</Alert> : null}
            {notice ? <Alert tone="warning">{notice}</Alert> : null}
            <CurrentPlan summary={summary} isPending={isPending} onRefresh={handleRefresh} />
            <SubscriptionUsage summary={summary} />
            <BillingHistory
                key={historyVersion}
                isEnabled={summary.isEnabled}
                hasCustomer={summary.hasCustomer}
            />
            <section aria-labelledby="billing-portal-title" className={styles.card}>
                <h2 id="billing-portal-title">Billing portal</h2>
                <p>
                    Manage payment methods, invoices and billing details in the provider&apos;s
                    hosted portal. Monthly billing starts with the first successful payment. Link
                    sends receipts and invoice emails.
                </p>
                <BillingButton action="portal" isEnabled={summary.isEnabled && summary.hasCustomer}>
                    Open billing portal
                </BillingButton>
            </section>
            {summary.status && summary.status !== 'ENDED' ? (
                <section aria-labelledby="cancel-subscription-title" className={styles.danger}>
                    <h2 id="cancel-subscription-title">Cancel subscription</h2>
                    <p>
                        Cancel in the billing portal at the end of the paid period. Your Club and
                        Session history stays in place. Plan and quantity changes are not offered.
                    </p>
                    <BillingButton
                        action="portal"
                        isDanger
                        isEnabled={summary.isEnabled && summary.hasCustomer}
                    >
                        Manage cancellation in portal
                    </BillingButton>
                </section>
            ) : null}
        </div>
    );
}
