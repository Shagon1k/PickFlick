import type { ISessionRoster, TSession } from '@pickflick/contracts';
import Image from 'next/image';

import SprocketDivider from '#components/ui/SprocketDivider/SprocketDivider';

import styles from '../../page.module.scss';
import NominationAuthors from '../NominationRivals/NominationAuthors';
import NominationRivals from '../NominationRivals/NominationRivals';
import SelectionScores from '../SelectionScores/SelectionScores';
import SessionFacts from '../SessionFacts/SessionFacts';
import SessionResults from '../SessionResults/SessionResults';
import { getPhaseMascot } from './phase-mascot';

/** Everything below the phase panel; the loading screen renders the same parts as skeletons. */
export default function DetailsSection({
    session,
    roster,
    isLoading = false,
}: { session: TSession } & (
    | { roster: ISessionRoster; isLoading?: false }
    | { roster?: never; isLoading: true }
)) {
    const isResultsPhase = session.phase === 'RATING' || session.phase === 'COMPLETED';
    const outcome = session.selectionOutcome;
    return (
        <>
            {!isResultsPhase && outcome?.source === 'LIVE' && outcome.breakdown ? (
                <NominationRivals
                    outcome={outcome}
                    breakdown={outcome.breakdown}
                    isLoading={isLoading}
                />
            ) : null}
            {!isResultsPhase && session.nominationAuthors ? (
                <NominationAuthors authors={session.nominationAuthors} isLoading={isLoading} />
            ) : null}
            {!isResultsPhase && session.selectionScores ? (
                <SelectionScores data={session.selectionScores} />
            ) : null}
            <div className={styles.reelBreak} aria-hidden="true">
                <SprocketDivider variant="section" />
                <Image src={getPhaseMascot(session.phase)} alt="" />
            </div>
            <h2 className={styles.detailsTitle}>Session Details</h2>
            {roster ? (
                <SessionFacts session={session} roster={roster} />
            ) : (
                <SessionFacts session={session} isLoading />
            )}
            {isResultsPhase ? <SessionResults session={session} isLoading={isLoading} /> : null}
        </>
    );
}
