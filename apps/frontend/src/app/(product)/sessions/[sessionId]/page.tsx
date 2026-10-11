import { notFound, redirect } from 'next/navigation';
import { connection } from 'next/server';

import { loginPath } from '@/api/session.server';
import { getSession } from '@/api/sessions.server';
import ProductFrame from '@/components/shells/ProductFrame/ProductFrame';
import ButtonLink from '@/components/ui/Button/ButtonLink';
import { ApiError } from '@/lib/api.server';

import SessionDetails from './_components/SessionDetails/SessionDetails';
import styles from './page.module.scss';

export const metadata = { title: 'Session — PickFlick' };
export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
    await connection();
    const { sessionId } = await params;
    let session;
    try {
        session = await getSession(sessionId);
    } catch (error) {
        if (error instanceof ApiError && error.status === 401)
            redirect(loginPath(`/sessions/${sessionId}`));
        if (error instanceof ApiError && [400, 404].includes(error.status)) notFound();
        return (
            <ProductFrame>
                <main className={styles.main}>
                    <h1>Session unavailable</h1>
                    <p role="alert">We could not load this Session. Try again shortly.</p>
                    <ButtonLink href="/app">Back to your Clubs</ButtonLink>
                </main>
            </ProductFrame>
        );
    }
    return (
        <ProductFrame>
            <SessionDetails session={session} />
        </ProductFrame>
    );
}
