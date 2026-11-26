import { CLUB_TIER_ENTITLEMENTS, type IBillingSummary } from '@pickflick/contracts';

import Progress from '#components/ui/Progress/Progress';

import styles from './SubscriptionPanel.module.scss';
export default function SubscriptionUsage({ summary }: { summary: IBillingSummary }) {
    const limits = CLUB_TIER_ENTITLEMENTS[summary.plan];
    return (
        <section aria-labelledby="billing-usage-title" className={styles.card}>
            <h2 id="billing-usage-title">Usage</h2>
            <div className={styles.usage}>
                <div className={styles.usage__card}>
                    <Progress
                        variant="usage"
                        label="Administered Clubs"
                        value={summary.usage.administeredClubs}
                        max={limits.adminClubLimit}
                    />
                </div>
                {summary.usage.clubs.map((club) => (
                    <div className={styles.usage__card} key={club.id}>
                        <Progress
                            variant="usage"
                            label={`Members in ${club.name}`}
                            value={club.members}
                            max={limits.memberLimit}
                        />
                    </div>
                ))}
            </div>
            {summary.usage.clubs.length === 0 ? (
                <p>
                    You do not administer any active Clubs. Pro belongs to your personal account;
                    you can subscribe before creating a Club.
                </p>
            ) : null}
        </section>
    );
}
