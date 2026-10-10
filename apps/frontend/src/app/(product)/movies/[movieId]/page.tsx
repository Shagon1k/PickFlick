import { movieIdSchema } from '@pickflick/contracts';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { getSessionState, loginPath } from '@/api/session.server';
import ProductFrame from '@/components/shells/ProductFrame/ProductFrame';
import ButtonLink from '@/components/ui/Button/ButtonLink';

import styles from '../../onboarding.module.scss';

export const metadata: Metadata = {
    title: 'Movie Details — PickFlick',
    robots: { index: false, follow: false },
};

export default async function MoviePage({ params }: { params: Promise<{ movieId: string }> }) {
    const { movieId } = await params;
    if (!movieIdSchema.safeParse(movieId).success) notFound();
    const session = await getSessionState();
    if (session === 'anonymous') redirect(loginPath(`/movies/${movieId}`));
    return (
        <ProductFrame>
            <main className={styles.readyMain}>
                <section className={styles.readyCard} aria-labelledby="movie-title">
                    <h1 id="movie-title">
                        {session === 'unavailable'
                            ? 'Your session is temporarily unavailable'
                            : 'Movie Details'}
                    </h1>
                    <p>
                        {session === 'unavailable'
                            ? 'Try loading this page again.'
                            : 'The details screen is coming soon. You can continue searching films from the header.'}
                    </p>
                    <ButtonLink href="/app">Back to Hub</ButtonLink>
                </section>
            </main>
        </ProductFrame>
    );
}
