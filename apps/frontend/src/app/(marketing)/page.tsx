import PublicShell from '#components/shells/PublicShell/PublicShell';
import BrandImage from '#components/ui/BrandImage/BrandImage';
import ButtonLink from '#components/ui/Button/ButtonLink';
import Icon from '#components/ui/Icon/Icon';
import { createPublicMetadata } from '#lib/public-metadata';

import LandingReveal from './_components/LandingReveal/LandingReveal';
import PlanHandoff from './_components/PlanHandoff/PlanHandoff';
import styles from './marketing.module.scss';
import { landingFeatures, landingSteps } from './marketing-content';

export const metadata = createPublicMetadata({
    title: 'PickFlick — Pick a film. Watch together. Remember everything.',
    description: 'Plan film nights with your Club, from nominations and scoring to shared history.',
    path: '/',
});

function SectionDivider() {
    return <div aria-hidden="true" className={styles.divider} />;
}

export default function HomePage() {
    return (
        <PublicShell>
            <LandingReveal>
                <section
                    aria-labelledby="landing-title"
                    className={`${styles.hero} ${styles.reveal}`}
                >
                    <div aria-hidden="true" className={styles.spotlight} />
                    <div className={`${styles.container} ${styles.heroInner}`}>
                        <h1 id="landing-title">
                            Pick a film.
                            <br />
                            <span className={styles.warmLine}>Watch together.</span>
                            <br />
                            Remember everything.
                        </h1>
                        <div className={styles.heroMascot}>
                            <BrandImage alt="" asset="hero" loading="eager" />
                        </div>
                        <div className={styles.heroActions}>
                            <ButtonLink href="/login" variant="primary">
                                Start your first Club
                            </ButtonLink>
                            <ButtonLink href="#how">See how it works</ButtonLink>
                        </div>
                    </div>
                </section>

                <SectionDivider />

                <section
                    aria-labelledby="journey-title"
                    className={`${styles.section} ${styles.reveal}`}
                    id="how"
                >
                    <div className={`${styles.container} ${styles.steps}`}>
                        <h2 className="visually-hidden" id="journey-title">
                            How PickFlick works
                        </h2>
                        <p className={styles.eyebrow}>The four-act structure</p>
                        {landingSteps.map((step, index) => (
                            <article className={styles.step} key={step.title}>
                                <div aria-hidden="true" className={styles.stepNumber}>
                                    {String(index + 1).padStart(2, '0')}
                                    <span>Scene</span>
                                </div>
                                <div>
                                    <h3>{step.title}</h3>
                                    <p>{step.description}</p>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>

                <SectionDivider />

                <section
                    aria-labelledby="features-title"
                    className={`${styles.section} ${styles.reveal}`}
                    id="features"
                >
                    <div className={styles.container}>
                        <div className={styles.featureHeader}>
                            <div>
                                <p className={styles.eyebrow}>Built for movie people</p>
                                <h2 id="features-title">
                                    Everything your Club needs to stop scrolling and start watching.
                                </h2>
                            </div>
                            <div className={styles.featureMascot}>
                                <BrandImage alt="" asset="calmEmptyWaiting" />
                            </div>
                        </div>
                        <div className={styles.featureGrid}>
                            {landingFeatures.map((feature) => (
                                <article className={styles.feature} key={feature.title}>
                                    <div className={styles.featureMark}>
                                        <Icon name={feature.icon} />
                                    </div>
                                    <h3>{feature.title}</h3>
                                    <p>{feature.description}</p>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                <SectionDivider />

                <section
                    aria-label="PickFlick promise"
                    className={`${styles.statementSection} ${styles.reveal}`}
                >
                    <p className={`${styles.container} ${styles.statement}`}>
                        No more group-chat chaos. One round of nominations, one scored Selection,
                        and your next film is decided.
                    </p>
                </section>

                <PlanHandoff
                    titleId="landing-handoff-title"
                    title={
                        <>
                            Stop arguing. <span className={styles.warmLine}>Start watching.</span>
                        </>
                    }
                    className={styles.reveal}
                    shouldLinkPricing
                />
            </LandingReveal>
        </PublicShell>
    );
}
