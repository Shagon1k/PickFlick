import type { ReactNode } from 'react';

import ProductFrame from '#components/shells/ProductFrame/ProductFrame';
import PublicShell from '#components/shells/PublicShell/PublicShell';
import styles from '#components/shells/SystemState/SystemState.module.scss';
import BrandImage from '#components/ui/BrandImage/BrandImage';
import Button from '#components/ui/Button/Button';
import ButtonLink from '#components/ui/Button/ButtonLink';

type TSystemStateVariant = 'application-error' | 'not-found' | 'members-only';

const SYSTEM_STATES = {
    'application-error': {
        asset: 'proPlan',
        code: '500',
        eyebrow: 'Technical difficulties',
        title: 'Projector Malfunction',
        description:
            'Something went wrong behind the scenes. Try again, or choose a safe route back to PickFlick.',
    },
    'not-found': {
        asset: 'errorRecovery',
        code: '404',
        eyebrow: 'Scene missing',
        title: 'Reel Not Found',
        // Filled in with the signed-in or public home's name.
        description: null,
    },
    'members-only': {
        asset: 'errorRecovery',
        code: '403',
        eyebrow: 'Private screening',
        title: 'Members Only',
        // Says nothing about whether the Session exists, only how a Club member gets in.
        description:
            'Sessions open only to their Club’s members. Ask a member for a Club invitation, then open this link again.',
    },
} as const;

interface ISystemStateProps {
    onRetry?: () => void;
    /** A page that failed to load retries by reloading this address. */
    retryHref?: string;
    isSignedIn: boolean;
    variant: TSystemStateVariant;
    /** Names what could not load, such as "Session unavailable". */
    title?: string;
    description?: string;
    /** Page-level helpers that must keep running, such as a progress poll. */
    children?: ReactNode;
}

export default function SystemState({
    onRetry,
    retryHref,
    isSignedIn,
    variant,
    title,
    description: customDescription,
    children,
}: ISystemStateProps) {
    const content = SYSTEM_STATES[variant];
    const destination = isSignedIn
        ? { href: '/app', label: 'Back to Hub' }
        : { href: '/', label: 'Back to main' };
    const homeName = isSignedIn ? 'Hub' : 'main page';
    const description =
        customDescription ??
        content.description ??
        `This page was cut from the final edit. Head back to the ${homeName} and pick up where you left off.`;
    const hasRetry = Boolean(onRetry ?? retryHref);

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
                        {title ?? content.title}
                    </h1>
                    <p className={styles.description}>{description}</p>
                    <div className={styles.actions}>
                        {onRetry ? <Button onClick={onRetry}>Try again</Button> : null}
                        {retryHref ? <ButtonLink href={retryHref}>Try again</ButtonLink> : null}
                        <ButtonLink
                            href={destination.href}
                            variant={hasRetry ? 'secondary' : 'primary'}
                        >
                            {destination.label}
                        </ButtonLink>
                    </div>
                </section>
            </div>
        </div>
    );

    return isSignedIn ? (
        <ProductFrame currentArea="recovery">
            <main>
                {children}
                {scene}
            </main>
        </ProductFrame>
    ) : (
        <PublicShell>{scene}</PublicShell>
    );
}
