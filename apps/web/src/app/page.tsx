import type { Metadata } from "next";

import { ActionLink, BrandImage } from "@pickflick/ui";

import { landingFeatures, landingSteps } from "../components/marketing/marketing-content";
import styles from "../components/marketing/marketing.module.css";
import { PublicShell } from "../components/shells/shells";

export const metadata: Metadata = {
  title: "PickFlick — Pick a film. Watch together. Remember everything.",
  description: "Plan film nights with your Club, from nominations and scoring to shared history.",
};

type FeatureIconName = (typeof landingFeatures)[number]["icon"];

function FeatureIcon({ name }: Readonly<{ name: FeatureIconName }>) {
  const common = { "aria-hidden": true, fill: "none", viewBox: "0 0 24 24" } as const;

  switch (name) {
    case "catalog":
      return <svg {...common}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2ZM8 7h8M8 10h6" /></svg>;
    case "pulse":
      return <svg {...common}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>;
    case "clock":
      return <svg {...common}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>;
    case "clubs":
      return <svg {...common}><rect height="18" rx="2" width="18" x="3" y="3" /><path d="M9 3v18M14 8h4M14 12h4" /></svg>;
    case "chart":
      return <svg {...common}><path d="M6 20v-4M12 20V10M18 20V4" /></svg>;
    case "device":
      return <svg {...common}><rect height="20" rx="3" width="14" x="5" y="2" /><path d="M10 18h4" /></svg>;
  }
}

function SprocketDivider() {
  return <div aria-hidden="true" className={styles.divider}><i /><i /><i /></div>;
}

export default function HomePage() {
  return (
    <PublicShell>
      <div className={styles.page}>
        <section aria-labelledby="landing-title" className={styles.hero}>
          <div aria-hidden="true" className={styles.spotlight} />
          <div className={`${styles.container} ${styles.heroInner}`}>
            <h1 id="landing-title">
              Pick a film.<br />
              <span className={styles.warmLine}>Watch together.</span><br />
              Remember everything.
            </h1>
            <div className={styles.heroMascot}>
              <BrandImage alt="" asset="hero" loading="eager" />
            </div>
            <div className={styles.heroActions}>
              <ActionLink href="/login" variant="primary">Start your first Club</ActionLink>
              <ActionLink href="#how">See how it works</ActionLink>
            </div>
          </div>
        </section>

        <SprocketDivider />

        <section aria-labelledby="journey-title" className={styles.section} id="how">
          <div className={`${styles.container} ${styles.steps}`}>
            <h2 className="pf-visually-hidden" id="journey-title">How PickFlick works</h2>
            <p className={styles.eyebrow}>The four-act structure</p>
            {landingSteps.map((step, index) => (
              <article className={styles.step} key={step.title}>
                <div aria-hidden="true" className={styles.stepNumber}>
                  {String(index + 1).padStart(2, "0")}<span>Scene</span>
                </div>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <SprocketDivider />

        <section aria-labelledby="features-title" className={styles.section} id="features">
          <div className={styles.container}>
            <div className={styles.featureHeader}>
              <div>
                <p className={styles.eyebrow}>Built for movie people</p>
                <h2 id="features-title">Everything your Club needs to stop scrolling and start watching.</h2>
              </div>
              <div className={styles.featureMascot}>
                <BrandImage alt="" asset="calmEmptyWaiting" />
              </div>
            </div>
            <div className={styles.featureGrid}>
              {landingFeatures.map((feature) => (
                <article className={styles.feature} key={feature.title}>
                  <div className={styles.featureMark}><FeatureIcon name={feature.icon} /></div>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <SprocketDivider />

        <section aria-label="PickFlick promise" className={styles.statementSection}>
          <p className={`${styles.container} ${styles.statement}`}>
            No more group-chat chaos. One round of nominations, one scored Selection, and your next film is decided.
          </p>
        </section>

        <section aria-labelledby="landing-handoff-title" className={styles.handoff}>
          <div className={styles.handoffInner}>
            <div>
              <h2 id="landing-handoff-title">Stop arguing. <span className={styles.warmLine}>Start watching.</span></h2>
              <ul aria-label="Free plan includes" className={styles.handoffFacts}>
                <li><strong>1</strong> administered Club</li>
                <li>Up to <strong>8</strong> members</li>
                <li>Unlimited Session history</li>
              </ul>
            </div>
            <div className={styles.handoffAction}>
              <div className={styles.handoffPrice}><strong>€0</strong><span>to start</span></div>
              <p className={styles.handoffNote}>No credit card required.</p>
              <ActionLink href="/login" variant="primary">Create your first Club</ActionLink>
            </div>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
