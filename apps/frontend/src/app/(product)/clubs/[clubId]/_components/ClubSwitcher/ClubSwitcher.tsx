import type { IClubSummary } from '@pickflick/contracts';
import Link from 'next/link';

import { selectClubAction } from '#app/(product)/app/actions';
import { getMonogram } from '#lib/format';

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
                <span aria-hidden="true" className={styles.clubMonogram}>
                    {getMonogram(club.name)}
                </span>
                <span className={styles.clubName}>{club.name}</span>
                <span className={styles.clubRole}>{club.membershipRole.toLowerCase()}</span>
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
}: {
    clubs: IClubSummary[];
    current: IClubSummary;
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
        <nav aria-label="Switch Club" className={styles.switcher}>
            <div className={styles.switcherHeader}>
                <p className={styles.eyebrow}>Your Clubs</p>
                <Link href="/clubs/new">Create a Club</Link>
            </div>
            <div className={styles.carousel}>
                <ClubArrow club={previous} label="Previous Club" direction="←" />
                <div className={styles.clubChoices}>
                    {choices.map((choice) => (
                        <ClubChoice club={choice} current={choice.id === club.id} key={choice.id} />
                    ))}
                </div>
                <ClubArrow club={next} label="Next Club" direction="→" />
            </div>
        </nav>
    );
}
