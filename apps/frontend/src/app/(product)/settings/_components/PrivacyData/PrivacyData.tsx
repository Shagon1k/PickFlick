import Link from 'next/link';

import Icon from '#components/ui/Icon/Icon';

import styles from './PrivacyData.module.scss';

export default function PrivacyData() {
    return (
        <section className={styles.privacy} aria-labelledby="privacy-heading">
            <h2 id="privacy-heading">Privacy &amp; data</h2>
            <p>
                Control your data below. The <Link href="/legal/privacy">Privacy Notice</Link>{' '}
                describes current behavior and launch policy targets. It remains a draft awaiting
                operator details and legal/privacy approval.
            </p>
            <div className={styles.disclosures}>
                <details>
                    <summary>
                        <span>Your stored data</span>
                        <Icon name="chevron-down" />
                    </summary>
                    <p>
                        Your profile, preferences, Library, Club memberships, Session contributions
                        and notifications support the service. Sign-in and operational records also
                        include security and delivery information. Shared visibility follows Club
                        settings.
                    </p>
                </details>
                <details>
                    <summary>
                        <span>Access, correction and portability</span>
                        <Icon name="chevron-down" />
                    </summary>
                    <p>
                        Edit your profile and appearance in Settings. Preview, import and export
                        your current Personal Ratings as CSV, or request an archive below. Session
                        Ratings remain separate from editable Personal Ratings.
                    </p>
                    <Link href="/settings?tab=import-export">
                        Import or export personal ratings
                    </Link>
                    <p>
                        For other rights requests, or personal details left in shared comments,
                        write to <a href="mailto:hello@pick-flick.app">hello@pick-flick.app</a>.
                    </p>
                </details>
            </div>
        </section>
    );
}
