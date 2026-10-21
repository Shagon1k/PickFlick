import type { IClubSummary } from '@pickflick/contracts';
import Link from 'next/link';

import { selectClubAction } from '#app/(product)/app/actions';

import styles from '../../page.module.scss';

function ClubChoice({ club, current }: { club: IClubSummary; current: boolean }) {
    return (
        <form action={selectClubAction} className={styles.clubChoice}>
            <input name="clubId" type="hidden" value={club.id} />
            <button
                aria-current={current ? 'page' : undefined}
                aria-label={`Open ${club.name}`}
                className={styles.clubButton}
                type="submit"
            >
                <span className="visually-hidden">{club.name}</span>
            </button>
        </form>
    );
}

function listClubChoices(clubs: IClubSummary[], current: IClubSummary): IClubSummary[] {
    return clubs.some(({ id }) => id === current.id)
        ? clubs.map((club) => (club.id === current.id ? current : club))
        : [current, ...clubs];
}

function ClubArrow({
    club,
    label,
    direction,
}: {
    club?: IClubSummary;
    label: string;
    direction: string;
}) {
    if (!club) return null;
    return (
        <form action={selectClubAction}>
            <input name="clubId" type="hidden" value={club.id} />
            <button aria-label={label} className={styles.arrow} type="submit">
                {direction}
            </button>
        </form>
    );
}

export default function ClubSwitcher({
    clubs,
    current,
    memberCount,
    sessionCount,
}: {
    clubs: IClubSummary[];
    current: IClubSummary;
    memberCount: number;
    sessionCount: number;
}) {
    const choices = listClubChoices(clubs, current);
    const club = current;
    const currentIndex = choices.findIndex(({ id }) => id === club.id);
    const previous =
        choices.length > 1
            ? choices[(currentIndex - 1 + choices.length) % choices.length]
            : undefined;
    const next = choices.length > 1 ? choices[(currentIndex + 1) % choices.length] : undefined;
    return (
        <div className={styles.switcher}>
            <div className={styles.switcherHeader}>
                <p className={styles.eyebrow}>Your Clubs</p>
                <Link href="/clubs/new">Create a Club</Link>
            </div>
            <div className={styles.carousel}>
                <ClubArrow club={previous} label="Previous Club" direction="←" />
                <div className={styles.clubHeading}>
                    <h1 id="hub-title">{club.name}</h1>
                    <p>
                        {memberCount} members · {sessionCount} Sessions ·{' '}
                        {club.tier === 'FREE' ? 'Free Club' : 'Pro Club'}
                    </p>
                    {club.description ? (
                        <p className={styles.description}>{club.description}</p>
                    ) : null}
                    <p>
                        Selection scale {club.selectionScaleMin}–{club.selectionScaleMax} ·{' '}
                        <span>
                            {club.membershipRole === 'ADMIN'
                                ? 'Admin'
                                : club.membershipRole.toLowerCase()}
                        </span>
                    </p>
                    <div className={styles.clubChoices}>
                        {choices.map((choice) => (
                            <ClubChoice
                                club={choice}
                                current={choice.id === club.id}
                                key={choice.id}
                            />
                        ))}
                    </div>
                </div>
                <ClubArrow club={next} label="Next Club" direction="→" />
            </div>
        </div>
    );
}
