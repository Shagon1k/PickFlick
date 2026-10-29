import { HTTP_STATUS } from '@pickflick/contracts';
import { redirect } from 'next/navigation';

import { buildLoginPath } from '#api/session.server';
import RetryButton from '#components/shells/RetryButton/RetryButton';
import ButtonLink from '#components/ui/Button/ButtonLink';
import { ApiError } from '#lib/api.server';
import { NOT_FOUND_STATUSES } from '#lib/http-status';

import styles from '../../page.module.scss';
import HubPanel from '../HubPanel/HubPanel';

interface IHubLoadFailureProps {
    error: unknown;
    /** Heading for a temporary failure, such as "Club Ratings are temporarily unavailable". */
    title: string;
    /** Where sign-in returns after an expired session. */
    returnPath: string;
}

/** The shared failure panel of every Club Hub tab, inside the frame the Hub layout draws. */
export default function HubLoadFailure({ error, title, returnPath }: IHubLoadFailureProps) {
    if (error instanceof ApiError && error.status === HTTP_STATUS.UNAUTHORIZED) {
        redirect(buildLoginPath(returnPath));
    }
    const isAccessLost = error instanceof ApiError && NOT_FOUND_STATUSES.includes(error.status);
    const card = (
        <div className={styles.failure}>
            <section aria-labelledby="hub-failure-title" className={styles.failureCard}>
                <p className={styles.eyebrow}>
                    {isAccessLost ? 'Private Club' : 'Temporary problem'}
                </p>
                <h1 id="hub-failure-title">{isAccessLost ? 'Club access unavailable' : title}</h1>
                <p>
                    {isAccessLost
                        ? 'This Club requires an active Membership. No Club details were disclosed.'
                        : 'Nothing was changed. Try again in a moment or return to your Clubs.'}
                </p>
                {isAccessLost ? null : <RetryButton />}
                <ButtonLink href="/app" variant="primary">
                    Back to your Clubs
                </ButtonLink>
            </section>
        </div>
    );
    // Only lost access clears the Club frame; a failed tab request keeps the Hub tabs usable.
    return isAccessLost ? <HubPanel hub={null}>{card}</HubPanel> : card;
}
