import { getSessionState } from '#api/auth-session.server';
import { getBillingOffer } from '#api/billing.server';
import BillingButton from '#components/billing/BillingButton/BillingButton';
import PublicShell from '#components/shells/PublicShell/PublicShell';
import BrandImage from '#components/ui/BrandImage/BrandImage';
import ButtonLink from '#components/ui/Button/ButtonLink';
import HorizontalScroll from '#components/ui/HorizontalScroll/HorizontalScroll';
import { createPublicMetadata } from '#lib/public-metadata';

import PlanHandoff from '../_components/PlanHandoff/PlanHandoff';
import styles from '../marketing.module.scss';
import {
    comparisonRows,
    freePlanFeatures,
    type IPlanFeature,
    proPlanFeatures,
} from '../marketing-content';
import PricingFaq from './_components/PricingFaq/PricingFaq';

export const metadata = createPublicMetadata({
    title: 'Pricing — PickFlick',
    description: 'Compare PickFlick Free and monthly Pro plans for your film Clubs.',
    path: '/pricing',
});

function SectionDivider() {
    return (
        <div aria-hidden="true" className={styles.divider}>
            <i />
            <i />
            <i />
        </div>
    );
}

function PlanFeatures({ features }: { features: readonly IPlanFeature[] }) {
    return (
        <ul className={styles.featureList}>
            {features.map(({ label, tone }) => (
                <li data-tone={tone} key={label}>
                    <span aria-hidden="true" className={styles.check}>
                        {tone === 'limited' ? '—' : '✓'}
                    </span>
                    {tone === 'upgrade' ? <strong>{label}</strong> : <span>{label}</span>}
                </li>
            ))}
        </ul>
    );
}

export default async function PricingPage() {
    let isEnabled = false;
    let isUnavailable = false;
    try {
        isEnabled = (await getBillingOffer()).isEnabled;
    } catch {
        isUnavailable = true;
        console.error('Billing offer could not be loaded.');
    }
    const isAnonymous = (await getSessionState()) === 'anonymous';
    let checkoutNote = 'Pro checkout is unavailable. You can start on Free.';
    if (isUnavailable) checkoutNote = 'Pro checkout is temporarily unavailable. Try again later.';
    if (isEnabled) checkoutNote = '';
    return (
        <PublicShell currentPage="pricing">
            <div className={styles.page}>
                <section aria-labelledby="pricing-title" className={styles.pricingHero}>
                    <div aria-hidden="true" className={styles.spotlight} />
                    <div className={`${styles.container} ${styles.heroInner}`}>
                        <h1 id="pricing-title">
                            One Club free.
                            <br />
                            <span className={styles.warmLine}>Go Pro when your crew grows.</span>
                        </h1>
                        <p className={styles.pricingLead}>
                            No per-seat pricing. The Club Admin pays. Everyone else joins free.
                        </p>
                        <div className={styles.pricingMascot}>
                            <BrandImage alt="" asset="tieBreakBalance" loading="eager" />
                        </div>
                    </div>
                </section>

                <section
                    aria-labelledby="plans-title"
                    className={`${styles.section} ${styles.plansSection}`}
                >
                    <div className={styles.container}>
                        <div className={styles.plansIntro}>
                            <h2 id="plans-title">Choose your screening room</h2>
                            <p>
                                Start with the essentials. Move to Pro only when you need more
                                Clubs, more members, or more control.
                            </p>
                        </div>
                        <div className={styles.planGrid}>
                            <article className={styles.planCard} data-plan="free">
                                <span className={styles.planIndex}>01 · Free</span>
                                <h3>Screening Room</h3>
                                <p className={styles.planDescription}>
                                    For one friend Club getting started.
                                </p>
                                <div className={styles.planPrice}>
                                    <strong>€0</strong>
                                    <span>/ forever</span>
                                </div>
                                <ButtonLink href="/login">Get started</ButtonLink>
                                <hr className={styles.planRule} />
                                <PlanFeatures features={freePlanFeatures} />
                            </article>

                            <article className={styles.planCard} data-plan="pro">
                                <span className={styles.planIndex}>02 · Pro</span>
                                <h3>Director&apos;s Cut</h3>
                                <p className={styles.planDescription}>
                                    For cinephiles running multiple crews.
                                </p>
                                <div className={styles.planPrice}>
                                    <strong>€5</strong>
                                    <span>/ month</span>
                                </div>
                                <BillingButton
                                    isEnabled={isEnabled}
                                    isAnonymous={isAnonymous}
                                    isFullWidth
                                />
                                <p className={styles.checkoutNote} id="pro-checkout-note">
                                    Plus applicable tax at checkout. Purchases are sold through
                                    Link.
                                </p>
                                {checkoutNote ? (
                                    <p className={styles.checkoutNote}>{checkoutNote}</p>
                                ) : null}
                                <hr className={styles.planRule} />
                                <PlanFeatures features={proPlanFeatures} />
                            </article>
                        </div>
                    </div>
                </section>

                <SectionDivider />

                <section
                    aria-labelledby="comparison-title"
                    className={`${styles.section} ${styles.comparisonSection}`}
                >
                    <div className={styles.container}>
                        <p className={`${styles.eyebrow} ${styles.centeredHeading}`}>
                            Full breakdown
                        </p>
                        <h2 id="comparison-title">Everything side by side</h2>
                        <HorizontalScroll label="Plan comparison" variant="ruled">
                            <table className={styles.comparisonTable}>
                                <caption>PickFlick Free and Pro plan comparison</caption>
                                <thead>
                                    <tr>
                                        <th scope="col">Feature</th>
                                        <th scope="col">Free</th>
                                        <th scope="col">Pro</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {comparisonRows.map((row) => (
                                        <tr key={row.feature}>
                                            <th scope="row">{row.feature}</th>
                                            <td>{row.free}</td>
                                            <td>{row.pro}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </HorizontalScroll>
                    </div>
                </section>

                <SectionDivider />

                <section
                    aria-labelledby="faq-title"
                    className={`${styles.container} ${styles.section} ${styles.faqSection}`}
                >
                    <p className={`${styles.eyebrow} ${styles.centeredHeading}`}>
                        Frequently asked
                    </p>
                    <h2 id="faq-title">You ask. We answer.</h2>
                    <PricingFaq />
                </section>

                <PlanHandoff
                    titleId="pricing-handoff-title"
                    title={
                        <>
                            Start free.{' '}
                            <span className={styles.warmLine}>
                                Upgrade when the Club outgrows it.
                            </span>
                        </>
                    }
                />
            </div>
        </PublicShell>
    );
}
