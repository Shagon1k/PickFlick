import { isFilmSessionPhase, type TSession } from '@pickflick/contracts';
import Image from 'next/image';

import MovieMedia from '#components/movies/MovieMedia/MovieMedia';
import ProductFrame from '#components/shells/ProductFrame/ProductFrame';
import { buildClubNavigation } from '#components/shells/shell-navigation';
import Skeleton from '#components/ui/Skeleton/Skeleton';
import SprocketDivider from '#components/ui/SprocketDivider/SprocketDivider';

import page from '../../page.module.scss';
import Nomination from '../Nomination/Nomination';
import NominationAuthors from '../NominationRivals/NominationAuthors';
import NominationRivals from '../NominationRivals/NominationRivals';
import PhaseProgress from '../PhaseProgress/PhaseProgress';
import YourRating from '../Rating/YourRating';
import Selection from '../Selection/Selection';
import SelectionScores from '../SelectionScores/SelectionScores';
import { getPhaseMascot } from '../SessionDetails/phase-mascot';
import SessionFacts from '../SessionFacts/SessionFacts';
import SessionResults from '../SessionResults/SessionResults';
import SessionHeaderSkeleton from './SessionHeaderSkeleton';
import styles from './SessionLoading.module.scss';

export default function SessionLoading({ session }: { session?: TSession }) {
    const phase = session?.phase;
    const header = <SessionHeaderSkeleton session={session} />;
    const isResults = phase === 'RATING' || phase === 'COMPLETED';
    return (
        <ProductFrame
            currentArea="session"
            clubItems={session ? buildClubNavigation(session.clubId, null) : []}
            sessionBackHref={session ? '/clubs/' + session.clubId : undefined}
        >
            <main className={page.main} aria-busy="true">
                <h1 className="visually-hidden">Session</h1>
                <div role="status">
                    <span className="visually-hidden">Loading Session and participation…</span>
                </div>
                <div aria-hidden="true" inert>
                    {session?.nominations ? (
                        <Nomination
                            sessionId={session.id}
                            data={session.nominations}
                            header={header}
                            isLoading
                        />
                    ) : session?.selection ? (
                        <Selection
                            sessionId={session.id}
                            data={session.selection}
                            header={header}
                            isLoading
                        />
                    ) : (
                        <>
                            {session && phase !== 'CANCELLED' ? (
                                <PhaseProgress>
                                    <Skeleton text={progressText(session)} />
                                </PhaseProgress>
                            ) : null}
                            {header}
                            {session?.movieId && isFilmSessionPhase(session.phase) ? (
                                <div className={page.film}>
                                    <MovieMedia
                                        title=""
                                        variant="session"
                                        isLoading
                                        shouldHidePhonePoster
                                    />
                                </div>
                            ) : null}
                            {phase === 'RATING' && session?.rating ? (
                                <YourRating
                                    sessionId={session.id}
                                    data={session.rating}
                                    isLoading
                                />
                            ) : null}
                        </>
                    )}
                    {session ? (
                        <>
                            {!isResults &&
                            session.selectionOutcome?.source === 'LIVE' &&
                            session.selectionOutcome.breakdown ? (
                                <NominationRivals
                                    outcome={session.selectionOutcome}
                                    breakdown={session.selectionOutcome.breakdown}
                                    isLoading
                                />
                            ) : !isResults && session.nominationAuthors ? (
                                <NominationAuthors authors={session.nominationAuthors} isLoading />
                            ) : null}
                            {!isResults && session.selectionScores ? (
                                <SelectionScores data={session.selectionScores} />
                            ) : null}
                            <div className={page.reelBreak}>
                                <SprocketDivider variant="section" />
                                <Image src={getPhaseMascot(session.phase)} alt="" />
                            </div>
                            <h2 className={page.detailsTitle}>Session Details</h2>
                            <SessionFacts session={session} isLoading />
                            {isResults ? <SessionResults session={session} isLoading /> : null}
                        </>
                    ) : (
                        <div className={styles.neutral}>
                            <Skeleton width="half" />
                            <Skeleton width="short" />
                        </div>
                    )}
                </div>
            </main>
        </ProductFrame>
    );
}

function progressText(session: TSession) {
    if (session.phase === 'COMPLETED')
        return 'This session has ended. The results are available below.';
    if (session.rating)
        return (
            'Rating in progress — ' +
            session.rating.submittedCount +
            ' of ' +
            session.rating.acceptedCount +
            ' members have rated.' +
            (session.rating.canSubmit ? ' Please rate.' : '')
        );
    return 'Members have joined the screening.';
}
