import { ActionLink, BrandImage, Button } from '@pickflick/ui';

import { ProductFrame, PublicShell } from '../shells/shells';
import styles from './system-state.module.css';

type SystemStateVariant = 'application-error' | 'not-found';

const systemStateContent = {
    'application-error': {
        asset: 'proPlan',
        code: '500',
        eyebrow: 'Technical difficulties',
        title: 'Projector Malfunction',
    },
    'not-found': {
        asset: 'errorRecovery',
        code: '404',
        eyebrow: 'Scene missing',
        title: 'Reel Not Found',
    },
} as const;

export function SystemState({
    onRetry,
    signedIn,
    variant,
}: Readonly<{
    onRetry?: () => void;
    signedIn: boolean;
    variant: SystemStateVariant;
}>) {
    const content = systemStateContent[variant];
    const destination = signedIn
        ? { href: '/app', label: 'Back to Hub' }
        : { href: '/', label: 'Back to main' };
    const description =
        variant === 'not-found'
            ? `This page was cut from the final edit. Head back to the ${signedIn ? 'Hub' : 'main page'} and pick up where you left off.`
            : 'Something went wrong behind the scenes. Try again, or choose a safe route back to PickFlick.';

    const scene = (
        <div className={styles.stage} data-system-state={variant}>
            <div className={styles.scene}>
                <div aria-hidden="true" className={styles.spotlight} />
                <div aria-hidden="true" className={styles.visual}>
                    <span className={styles.code}>{content.code}</span>
                    <BrandImage
                        asset={content.asset}
                        alt=""
                        className={styles.mascot}
                        loading="eager"
                    />
                </div>

                <section aria-labelledby="system-state-title" className={styles.body}>
                    <p className={styles.eyebrow}>{content.eyebrow}</p>
                    <h1 id="system-state-title" tabIndex={-1}>
                        {content.title}
                    </h1>
                    <p className={styles.description}>{description}</p>
                    <div className={styles.actions}>
                        {onRetry ? <Button onClick={onRetry}>Try again</Button> : null}
                        <ActionLink
                            href={destination.href}
                            variant={onRetry ? 'secondary' : 'primary'}
                        >
                            {destination.label}
                        </ActionLink>
                    </div>
                </section>
            </div>
        </div>
    );

    return signedIn ? (
        <ProductFrame currentArea="recovery">
            <main>{scene}</main>
        </ProductFrame>
    ) : (
        <PublicShell>{scene}</PublicShell>
    );
}
