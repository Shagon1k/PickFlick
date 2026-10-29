'use client';

import type { TAchievement, TAchievements } from '@pickflick/contracts';
import { useState } from 'react';

import Icon from '#components/ui/Icon/Icon';
import Progress from '#components/ui/Progress/Progress';
import { toIsoDate } from '#lib/format';

import styles from './Achievements.module.scss';

const PERCENT = 100;

const STATUSES: { status: TAchievement['status']; label: string }[] = [
    { status: 'unlocked', label: 'Unlocked' },
    { status: 'in-progress', label: 'In progress' },
    { status: 'not-started', label: 'Not started' },
];

export default function Achievements({ items }: TAchievements) {
    const [selected, setSelected] = useState(STATUSES.map(({ status }) => status));
    const visible = items.filter((item) => selected.includes(item.status));
    const unlocked = items.filter((item) => item.status === 'unlocked').length;
    function handleToggle(status: TAchievement['status']) {
        setSelected((current) =>
            current.includes(status)
                ? current.filter((value) => value !== status)
                : [...current, status],
        );
    }
    return (
        <section className={styles.achievements} aria-labelledby="achievements-title">
            <h2 id="achievements-title">Achievements</h2>
            <p>
                Goals use recorded activity when you open this view. Unlocked achievements keep the
                rules and evidence that earned them.
            </p>
            <div className={styles.summary} role="group" aria-label="Achievement filters">
                {STATUSES.map(({ status, label }) => (
                    <button
                        key={status}
                        type="button"
                        aria-pressed={selected.includes(status)}
                        onClick={() => handleToggle(status)}
                    >
                        <strong>{items.filter((item) => item.status === status).length}</strong>
                        <span>{label}</span>
                    </button>
                ))}
                <div className={styles.completion}>
                    <strong>
                        {items.length ? Math.round((unlocked / items.length) * PERCENT) : 0}%
                    </strong>
                    <span>Completion</span>
                </div>
            </div>
            <p role="status">
                {visible.length} of {items.length} achievements shown
            </p>
            {visible.length === 0 && (
                <p>No achievements match these filters. Select a status above to show its goals.</p>
            )}
            <div className={styles.shelf}>
                {visible.map((item) => (
                    <AchievementCard key={`${item.key}-${item.version}`} item={item} />
                ))}
            </div>
        </section>
    );
}

function AchievementCard({ item }: { item: TAchievement }) {
    return (
        <article className={styles.card} data-status={item.status} aria-label={item.title}>
            <div className={styles.icon}>
                <Icon name="achievements" />
            </div>
            <span className={styles.status}>
                {STATUSES.find(({ status }) => status === item.status)?.label}
            </span>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            {item.progress === null ? (
                <p>{item.explanation}</p>
            ) : (
                <>
                    <Progress
                        label="Recorded progress"
                        value={item.progress}
                        max={item.target}
                        compact
                    />
                    <details>
                        <summary>How this is calculated · v{item.version}</summary>
                        <p>{item.explanation}</p>
                        {item.awardedAt && (
                            <p>
                                Unlocked{' '}
                                <time dateTime={item.awardedAt}>{toIsoDate(item.awardedAt)}</time>{' '}
                                (UTC). Earned history is retained.
                            </p>
                        )}
                    </details>
                </>
            )}
        </article>
    );
}
