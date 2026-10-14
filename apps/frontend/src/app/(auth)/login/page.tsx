import { resolveAuthReturnTarget } from '@pickflick/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';

import { getSessionState, isAppleSignInEnabled } from '@/api/session.server';
import BrandImage from '@/components/ui/BrandImage/BrandImage';
import Icon from '@/components/ui/Icon/Icon';
import SprocketDivider from '@/components/ui/SprocketDivider/SprocketDivider';

import LoginActions from './_components/LoginActions/LoginActions';
import { getFirstSearchValue } from './login.utils';
import { resolveLoginErrorMessage, SESSION_UNAVAILABLE_MESSAGE } from './login-errors';
import styles from './page.module.scss';

export const metadata: Metadata = {
    title: 'Sign in — PickFlick',
    description: 'Sign in to PickFlick with an approved identity provider.',
};

export default async function LoginPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    await connection();
    const parameters = await searchParams;
    const returnTo = resolveAuthReturnTarget(getFirstSearchValue(parameters.returnTo));
    const session = await getSessionState();
    if (session === 'authenticated') {
        redirect(returnTo);
    }
    const isAppleEnabled = isAppleSignInEnabled();
    // Sign-in stays available during a session-API outage; the notice explains a stale signed-in state.
    const errorMessage =
        resolveLoginErrorMessage(getFirstSearchValue(parameters.error)) ??
        (session === 'unavailable' ? SESSION_UNAVAILABLE_MESSAGE : undefined);

    return (
        <main className={styles.page}>
            <Link className={styles.backLink} href="/">
                <Icon name="arrow-left" />
                Back
            </Link>
            <section aria-labelledby="login-title" className={styles.scene}>
                <div aria-hidden="true" className={styles.spotlight} />
                <BrandImage
                    alt=""
                    asset="searchDiscovery"
                    className={styles.mascot}
                    loading="eager"
                />
                <div className={styles.card}>
                    <h1 id="login-title">Welcome to PickFlick</h1>
                    <p className={styles.lead}>Sign in to join your group&apos;s screening room.</p>
                    {errorMessage ? (
                        <p className={styles.errorBanner} role="alert">
                            {errorMessage}
                        </p>
                    ) : null}
                    <LoginActions appleSignInEnabled={isAppleEnabled} returnTo={returnTo} />
                    <p className={styles.legal}>
                        By continuing, you agree to PickFlick&apos;s{' '}
                        <Link href="/legal/terms">Terms of Service</Link> and{' '}
                        <Link href="/legal/privacy">Privacy Notice</Link>.
                    </p>
                </div>
                <SprocketDivider />
                <p className={styles.ornament}>Scene 01 · The Arrival</p>
            </section>
        </main>
    );
}
