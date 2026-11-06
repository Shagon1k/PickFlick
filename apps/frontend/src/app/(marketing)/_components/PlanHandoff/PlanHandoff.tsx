import { CLUB_TIER_ENTITLEMENTS } from '@pickflick/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';

import ButtonLink from '#components/ui/Button/ButtonLink';

import styles from '../../marketing.module.scss';

const FREE = CLUB_TIER_ENTITLEMENTS.FREE;

/** The closing Free-plan call to action shared by the landing and pricing pages. */
export default function PlanHandoff({
    titleId,
    title,
    className,
    shouldLinkPricing = false,
}: {
    titleId: string;
    title: ReactNode;
    className?: string;
    shouldLinkPricing?: boolean;
}) {
    return (
        <section
            aria-labelledby={titleId}
            className={className ? `${styles.handoff} ${className}` : styles.handoff}
        >
            <div className={styles.handoffInner}>
                <div>
                    <h2 id={titleId}>{title}</h2>
                    <ul aria-label="Free plan includes" className={styles.handoffFacts}>
                        <li>
                            <strong>{FREE.adminClubLimit}</strong> administered Club
                        </li>
                        <li>
                            Up to <strong>{FREE.memberLimit}</strong> members
                        </li>
                        <li>Unlimited Session history</li>
                    </ul>
                </div>
                <div className={styles.handoffAction}>
                    <div className={styles.handoffPrice}>
                        <strong>€0</strong>
                        <span>to start</span>
                    </div>
                    <p className={styles.handoffNote}>No credit card required.</p>
                    <ButtonLink href="/login" variant="primary">
                        Create your first Club
                    </ButtonLink>
                    {shouldLinkPricing ? (
                        <Link className={styles.handoffLink} href="/pricing">
                            Compare plans
                        </Link>
                    ) : null}
                </div>
            </div>
        </section>
    );
}
