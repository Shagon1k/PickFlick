'use client';

import type { IClubSummary } from '@pickflick/contracts';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useRef, useTransition } from 'react';

import { selectClubAction } from '#app/(product)/app/actions';
import Icon from '#components/ui/Icon/Icon';
import { formatCount } from '#lib/format';

import styles from './ClubSwitcher.module.scss';

const SWIPE_MIN_PX = 48;
const SWIPE_DOMINANCE = 1.5;

export default function ClubSwitcher({
    clubs,
    current,
    memberCount,
    sessionCount,
    isCreating,
    onCreateChange,
}: {
    clubs: IClubSummary[];
    current: IClubSummary;
    memberCount: number;
    sessionCount: number;
    /** Owned by the Hub frame, which hides the Call Sheet and sections while creating. */
    isCreating: boolean;
    onCreateChange: (isCreating: boolean) => void;
}) {
    const pathname = usePathname();
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    const choices = clubs.some(({ id }) => id === current.id) ? clubs : [current, ...clubs];
    const currentIndex = choices.findIndex(({ id }) => id === current.id);
    const index = isCreating ? choices.length : currentIndex;
    function select(nextIndex: number) {
        const club = choices[nextIndex];
        if (!club || club.id === current.id) {
            onCreateChange(!club);
            return;
        }
        // Keep the create slot until navigation mounts the selected Club's frame.
        const form = new FormData();
        form.set('clubId', club.id);
        // A redirect from the action would scroll to the new Hub segment; the switcher stays put.
        startTransition(async () => {
            const href = await selectClubAction(form);
            router.push(href, { scroll: false });
        });
    }
    const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
    const handlePrevious = () => select((index + choices.length) % (choices.length + 1));
    const handleNext = () => select((index + 1) % (choices.length + 1));
    // A clearly sideways swipe over the Club name switches Clubs; vertical scrolling stays untouched.
    function handleSwipeEnd(event: React.TouchEvent) {
        const start = swipeStartRef.current;
        const touch = event.changedTouches[0];
        swipeStartRef.current = null;
        if (!start || !touch || isPending) return;
        const dx = touch.clientX - start.x;
        const dy = touch.clientY - start.y;
        if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * SWIPE_DOMINANCE) return;
        if (dx < 0) handleNext();
        else handlePrevious();
    }
    const established = new Intl.DateTimeFormat('en', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(current.createdAt));
    return (
        <section
            className={styles.switcher}
            aria-label="Switch Club"
            aria-busy={isPending || undefined}
        >
            <div className={styles.row}>
                <button
                    className={styles.arrow}
                    aria-label="Previous Club"
                    disabled={isPending}
                    onClick={handlePrevious}
                    type="button"
                >
                    <Icon name="arrow-left" />
                </button>
                <div
                    className={styles.stage}
                    onTouchEnd={handleSwipeEnd}
                    onTouchStart={(event) => {
                        const touch = event.touches[0];
                        swipeStartRef.current = touch
                            ? { x: touch.clientX, y: touch.clientY }
                            : null;
                    }}
                >
                    <Link
                        className={styles.create}
                        href={`/clubs/new?returnTo=${encodeURIComponent(pathname)}`}
                        aria-hidden={!isCreating}
                        inert={!isCreating || isPending}
                        prefetch={isCreating ? undefined : false}
                    >
                        <span className={styles.createCircle} aria-hidden="true">
                            <Icon name="plus" />
                        </span>
                        <h1>Create new club</h1>
                    </Link>
                    <div className={styles.heading} aria-hidden={isCreating}>
                        <h1 id="hub-title">{current.name}</h1>
                        <p>
                            {formatCount(memberCount, 'member')} <span>·</span>{' '}
                            {formatCount(sessionCount, 'session')} <span>·</span> Est. {established}
                        </p>
                    </div>
                </div>
                <button
                    className={styles.arrow}
                    aria-label="Next Club"
                    data-direction="next"
                    disabled={isPending}
                    onClick={handleNext}
                    type="button"
                >
                    <Icon name="arrow-left" />
                </button>
            </div>
            {/* Position only: the arrows and swipe switch Clubs. */}
            <div className={styles.dots} aria-hidden="true">
                {[...choices.map((club) => club.id), 'create'].map((key, i) => (
                    <span
                        className={styles.dot}
                        data-current={index === i || undefined}
                        key={key}
                    />
                ))}
            </div>
        </section>
    );
}
