import { ActionLink, BrandImage, Button } from "@pickflick/ui";

import styles from "./system-state.module.css";

type SystemStateVariant = "application-error" | "not-found";

const systemStateContent = {
  "application-error": {
    asset: "proPlan",
    code: "500",
    description: "Something went wrong behind the scenes. Try again, or choose a safe route back to PickFlick.",
    eyebrow: "Technical difficulties",
    title: "Projector Malfunction",
  },
  "not-found": {
    asset: "errorRecovery",
    code: "404",
    description: "This page was cut from the final edit. Choose a safe route and pick up where you left off.",
    eyebrow: "Scene missing",
    title: "Reel Not Found",
  },
} as const;

export function SystemState({
  onRetry,
  variant,
}: Readonly<{
  onRetry?: () => void;
  variant: SystemStateVariant;
}>) {
  const content = systemStateContent[variant];
  const isApplicationError = variant === "application-error";

  return (
    <div className={styles.stage} data-system-state={variant}>
      <header className={styles.header}>
        <a aria-label="PickFlick home" className={styles.brand} href="/">
          <BrandImage alt="" asset="logo" loading="eager" />
          <span>PickFlick</span>
        </a>
        <span aria-hidden="true" className={styles.format}>Projector Noir</span>
      </header>

      <main className={styles.scene}>
        <div aria-hidden="true" className={styles.spotlight} />
        <div aria-hidden="true" className={styles.visual}>
          <span className={styles.code}>{content.code}</span>
          <BrandImage asset={content.asset} alt="" className={styles.mascot} loading="eager" />
        </div>

        <section aria-labelledby="system-state-title" className={styles.body}>
          <p className={styles.eyebrow}>{content.eyebrow}</p>
          <h1 id="system-state-title" tabIndex={-1}>{content.title}</h1>
          <p className={styles.description}>{content.description}</p>
          <div className={styles.actions}>
            {onRetry ? <Button onClick={onRetry}>Try again</Button> : null}
            {isApplicationError ? <ActionLink href="/app">Back to Hub</ActionLink> : null}
            <ActionLink href="/" variant={isApplicationError ? "ghost" : "primary"}>
              PickFlick home
            </ActionLink>
          </div>
        </section>
      </main>
    </div>
  );
}
