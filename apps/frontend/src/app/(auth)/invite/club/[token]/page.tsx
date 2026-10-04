import { invitationTokenSchema, type TInvitationPreview } from '@pickflick/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { previewInvitation } from '@/api/invitations.server';
import BrandImage from '@/components/ui/BrandImage/BrandImage';
import Icon from '@/components/ui/Icon/Icon';
import SprocketDivider from '@/components/ui/SprocketDivider/SprocketDivider';
import { ApiError } from '@/lib/api.server';

import Invitation from './_components/Invitation/Invitation';
import styles from './page.module.scss';

export const metadata: Metadata = {
    title: 'Club invitation — PickFlick',
    description: 'Review your Club invitation securely.',
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
};

async function InvitationContent({ params }: { params: Promise<{ token: string }> }) {
    await connection();
    const { token } = await params;
    if (!invitationTokenSchema.safeParse(token).success) {
        return <Invitation initial={{ state: 'invalid' }} token="" />;
    }
    let initial: TInvitationPreview | { state: 'sign-in' | 'error' };
    try {
        initial = await previewInvitation(token);
    } catch (error) {
        initial = {
            state: error instanceof ApiError && error.status === 401 ? 'sign-in' : 'error',
        };
    }
    return <Invitation initial={initial} key={token} token={token} />;
}

export default function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
    return (
        <main className={styles.page}>
            <Link className={styles.backLink} href="/app">
                <Icon name="arrow-left" />
                Back
            </Link>
            <section aria-label="Club invitation" className={styles.scene}>
                <BrandImage alt="" asset="invitation" className={styles.mascot} loading="eager" />
                <Suspense fallback={<Invitation initial={{ state: 'loading' }} token="" />}>
                    <InvitationContent params={params} />
                </Suspense>
                <SprocketDivider />
                <p className={styles.ornament}>Scene 03 · The Invitation</p>
            </section>
        </main>
    );
}
