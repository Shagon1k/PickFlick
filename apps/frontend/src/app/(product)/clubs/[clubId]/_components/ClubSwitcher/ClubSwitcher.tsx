'use client';

import type { IClubSummary } from '@pickflick/contracts';
import Link from 'next/link';
import { useState, useTransition } from 'react';

import { selectClubAction } from '#app/(product)/app/actions';

import styles from './ClubSwitcher.module.scss';

export default function ClubSwitcher({
    clubs,
    current,
    memberCount,
    sessionCount,
    onCreateChange,
}: {
    clubs: IClubSummary[];
    current: IClubSummary;
    memberCount: number;
    sessionCount: number;
    onCreateChange: (isCreating: boolean) => void;
}) {
    const [isCreating, setIsCreating] = useState(false);
    const [isPending, startTransition] = useTransition();
    const choices = clubs.some(({ id }) => id === current.id) ? clubs : [current, ...clubs];
    const currentIndex = choices.findIndex(({ id }) => id === current.id);
    const index = isCreating ? choices.length : currentIndex;
    function select(nextIndex: number) {
        const isCreate = nextIndex === choices.length;
        setIsCreating(isCreate);
        onCreateChange(isCreate);
        const club = choices[nextIndex];
        if (!club || club.id === current.id) return;
        const form = new FormData();
        form.set('clubId', club.id);
        startTransition(() => selectClubAction(form));
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
                    onClick={() => select((index + choices.length) % (choices.length + 1))}
                    type="button"
                >
                    <span>
                        <svg aria-hidden="true" viewBox="0 0 24 24">
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                    </span>
                </button>
                <div className={styles.stage}>
                    {isCreating ? (
                        <Link className={styles.create} href="/clubs/new">
                            <span className={styles.createCircle} aria-hidden="true">
                                +
                            </span>
                            <h1>Create new club</h1>
                        </Link>
                    ) : (
                        <div className={styles.heading}>
                            <h1 id="hub-title">{current.name}</h1>
                            <p>
                                {memberCount} members <span>·</span> {sessionCount}{' '}
                                {sessionCount === 1 ? 'session' : 'sessions'} <span>·</span> Est.{' '}
                                {established}
                            </p>
                        </div>
                    )}
                </div>
                <button
                    className={styles.arrow}
                    aria-label="Next Club"
                    disabled={isPending}
                    onClick={() => select((index + 1) % (choices.length + 1))}
                    type="button"
                >
                    <span>
                        <svg aria-hidden="true" viewBox="0 0 24 24">
                            <polyline points="9 18 15 12 9 6" />
                        </svg>
                    </span>
                </button>
            </div>
            {/* A position indicator only: the 44px arrows switch Clubs, as in the prototype. */}
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
