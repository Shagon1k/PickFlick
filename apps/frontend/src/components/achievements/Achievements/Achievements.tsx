'use client';

import type { TAchievement, TAchievements } from '@pickflick/contracts';
import { useState } from 'react';

import InfoTip from '#components/ui/InfoTip/InfoTip';
import LocalTime from '#components/ui/LocalTime/LocalTime';

import { ACHIEVEMENT_ICONS } from './achievement-icons';
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
            <div className={styles.summary} role="group" aria-label="Achievement filters">
                {STATUSES.map(({ status, label }) => (
                    <button
                        key={status}
                        type="button"
                        aria-pressed={selected.includes(status)}
                        onClick={() => handleToggle(status)}
                    >
                        <span aria-hidden="true" className={styles.check} />
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
            <p className="visually-hidden" role="status">
                {visible.length} of {items.length} achievements shown
            </p>
            {visible.length === 0 && <p>Select a status above to show its achievements.</p>}
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
            <span className={styles.about}>
                <InfoTip label={`How ${item.title} is counted`}>
                    {item.explanation}
                    {item.awardedAt ? (
                        <>
                            {' '}
                            Unlocked <LocalTime format="date" value={item.awardedAt} />.
                        </>
                    ) : null}
                </InfoTip>
            </span>
            <div className={styles.icon}>
                <svg
                    aria-hidden="true"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                    viewBox="0 0 24 24"
                >
                    {ACHIEVEMENT_ICONS[item.key] ?? ACHIEVEMENT_ICONS['first-screening']}
                </svg>
            </div>
            <span className={styles.status}>
                {STATUSES.find(({ status }) => status === item.status)?.label}
            </span>
            <h3 title={item.title}>{item.title}</h3>
            <p className={styles.description}>{item.description}</p>
            {item.progress === null ? null : (
                <div className={styles.progress}>
                    <span>
                        {item.progress} / {item.target}
                    </span>
                    <span
                        aria-label={`${item.progress} of ${item.target}`}
                        aria-valuemax={item.target}
                        aria-valuemin={0}
                        aria-valuenow={item.progress}
                        className={styles.bar}
                        role="progressbar"
                    >
                        <i style={{ width: `${(item.progress / item.target) * PERCENT}%` }} />
                    </span>
                </div>
            )}
        </article>
    );
}
