import { isFilmSessionPhase, type TSession } from '@pickflick/contracts';

import MovieMedia from '#components/movies/MovieMedia/MovieMedia';
import ProductFrame from '#components/shells/ProductFrame/ProductFrame';
import { buildClubNavigation } from '#components/shells/shell-navigation';
import Skeleton from '#components/ui/Skeleton/Skeleton';

import page from '../../page.module.scss';
import Nomination from '../Nomination/Nomination';
import PhaseProgress from '../PhaseProgress/PhaseProgress';
import YourRating from '../Rating/YourRating';
import Selection from '../Selection/Selection';
import DetailsSection from '../SessionDetails/DetailsSection';
import SessionHeaderSkeleton from './SessionHeaderSkeleton';
import styles from './SessionLoading.module.scss';

export default function SessionLoading({ session }: { session?: TSession }) {
    return (
        <ProductFrame
            currentArea="session"
            clubItems={session ? buildClubNavigation(session.clubId, null) : []}
            sessionBackHref={session ? `/clubs/${session.clubId}` : undefined}
        >
            <main className={page.main} aria-busy="true">
                <h1 className="visually-hidden">Session</h1>
                <div role="status">
                    <span className="visually-hidden">Loading Session and participation…</span>
                </div>
                <div aria-hidden="true" inert>
                    <PhaseContent session={session} />
                    <DetailsContent session={session} />
                </div>
            </main>
        </ProductFrame>
    );
}

function PhaseContent({ session }: { session?: TSession }) {
    const header = <SessionHeaderSkeleton session={session} />;
    if (session?.nominations)
        return (
            <Nomination
                sessionId={session.id}
                data={session.nominations}
                header={header}
                isLoading
            />
        );
    if (session?.selection)
        return (
            <Selection sessionId={session.id} data={session.selection} header={header} isLoading />
        );
    return (
        <>
            {session && session.phase !== 'CANCELLED' ? (
                <PhaseProgress>
                    <Skeleton text={progressText(session)} />
                </PhaseProgress>
            ) : null}
            {header}
            {session?.movieId && isFilmSessionPhase(session.phase) ? (
                <div className={page.film}>
                    <MovieMedia title="" variant="session" isLoading shouldHidePhonePoster />
                </div>
            ) : null}
            {session?.phase === 'RATING' && session.rating ? (
                <YourRating sessionId={session.id} data={session.rating} isLoading />
            ) : null}
        </>
    );
}
function DetailsContent({ session }: { session?: TSession }) {
    if (!session)
        return (
            <div className={styles.neutral}>
                <Skeleton width="half" />
                <Skeleton width="short" />
            </div>
        );
    return <DetailsSection session={session} isLoading />;
}

function progressText(session: TSession) {
    if (session.phase === 'COMPLETED')
        return 'This session has ended. The results are available below.';
    if (session.rating)
        return `Rating in progress — ${session.rating.submittedCount} of ${
            session.rating.acceptedCount
        } members have rated.${session.rating.canSubmit ? ' Please rate.' : ''}`;
    return 'Members have joined the screening.';
}
