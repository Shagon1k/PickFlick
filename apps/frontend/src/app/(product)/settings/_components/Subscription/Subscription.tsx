import { getBilling } from '#api/billing.server';

import SubscriptionPanel from './SubscriptionPanel';

export default async function Subscription({ checkout }: { checkout?: string | string[] }) {
    let summary = null;
    try {
        summary = await getBilling();
    } catch {
        console.error('Subscription status could not be loaded.');
    }
    return (
        <SubscriptionPanel
            initial={summary}
            checkout={typeof checkout === 'string' ? checkout : undefined}
        />
    );
}
