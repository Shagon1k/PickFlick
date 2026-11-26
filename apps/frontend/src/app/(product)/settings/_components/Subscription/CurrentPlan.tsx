import { CLUB_TIER_ENTITLEMENTS, type IBillingSummary } from '@pickflick/contracts';

import BillingButton from '#components/billing/BillingButton/BillingButton';
import Button from '#components/ui/Button/Button';

import styles from './SubscriptionPanel.module.scss';
const STATUS_COPY = {
    PENDING: 'Payment pending',
    ACTIVE: 'Active',
    PAYMENT_OVERDUE: 'Payment overdue',
    PAUSED: 'Paused',
    ENDED: 'Ended',
};

function formatDate(date: string) {
    return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' }).format(
        new Date(date),
    );
}

function getPeriodLabel(summary: IBillingSummary) {
    if (summary.cancelAtPeriodEnd) return 'Cancellation scheduled for';
    return summary.status === 'ACTIVE' ? 'Renews on' : 'Current billing period ends';
}

export default function CurrentPlan({
    summary,
    isPending,
    onRefresh,
}: {
    summary: IBillingSummary;
    isPending: boolean;
    onRefresh: () => void;
}) {
    const limits = CLUB_TIER_ENTITLEMENTS[summary.plan];
    const canCheckout = !summary.status || summary.status === 'ENDED';
    return (
        <section aria-labelledby="current-plan-title" className={styles.card}>
            <div className={styles.card__heading}>
                <h2 id="current-plan-title">Current plan</h2>
                <Button
                    aria-label="Refresh subscription status"
                    loading={isPending}
                    onClick={onRefresh}
                    size="small"
                    variant="ghost"
                >
                    Refresh status
                </Button>
            </div>
            <div className={styles.plan}>
                <div>
                    <h3>
                        {summary.plan === 'PRO' ? 'Pro' : 'Free'}{' '}
                        <span className={styles.badge}>
                            {summary.status ? STATUS_COPY[summary.status] : 'Active'}
                        </span>
                    </h3>
                    <p>
                        {summary.plan === 'PRO' ? '€5/month plus applicable tax' : '€0/month'} —{' '}
                        {limits.adminClubLimit} administered{' '}
                        {limits.adminClubLimit === 1 ? 'Club' : 'Clubs'}, up to {limits.memberLimit}{' '}
                        members per Club
                    </p>
                    {summary.periodEnd ? (
                        <p>
                            {getPeriodLabel(summary)} {formatDate(summary.periodEnd)}.
                        </p>
                    ) : null}
                    {summary.paidThrough ? (
                        <p>Paid through {formatDate(summary.paidThrough)}.</p>
                    ) : null}
                </div>
                {canCheckout ? (
                    <div className={styles.plan__action}>
                        <BillingButton isEnabled={summary.isEnabled} isFullWidth>
                            {summary.hasCheckout ? 'Continue checkout' : 'Upgrade to Pro'}
                        </BillingButton>
                    </div>
                ) : null}
            </div>
            {!summary.isEnabled ? (
                <p>Pro checkout is unavailable. You can continue on Free.</p>
            ) : null}
            <p>Purchases are sold through Link. Tax is calculated at checkout.</p>
        </section>
    );
}
