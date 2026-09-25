'use client';

import { type IClubSettings } from '@pickflick/contracts';

import { clubNavigation } from '@/components/shells/shell-navigation';
import styles from '../../settings.module.scss';

import { AvatarCard, ClubInfoCard, VisibilityCard } from './ClubSettingsCards';
import { DangerZone } from './ClubDangerZone';

const roleLabels: Readonly<Record<IClubSettings['club']['membershipRole'], string>> = {
    ADMIN: 'Admin',
    MODERATOR: 'Moderator',
    MEMBER: 'Member',
};

export function ClubSettings({ projection }: Readonly<{ projection: IClubSettings }>) {
    const active = projection.club.lifecycle === 'ACTIVE';
    const role = projection.club.membershipRole;
    const roleLabel = roleLabels[role];
    return (
        <main className={styles.layout}>
            <header className={styles.hero}>
                <h1>{projection.club.name}</h1>
                <p className={styles.meta}>
                    <span>
                        {projection.members.length} of {projection.entitlements.memberLimit} members
                    </span>
                    <span aria-hidden="true" className={styles.sep}>
                        ·
                    </span>
                    <span>{projection.club.tier === 'FREE' ? 'Free' : 'Pro'} Club</span>
                    <span aria-hidden="true" className={styles.sep}>
                        ·
                    </span>
                    <span>You are {roleLabel}</span>
                    {!active ? (
                        <>
                            <span aria-hidden="true" className={styles.sep}>
                                ·
                            </span>
                            <span className={styles.archived}>Archived</span>
                        </>
                    ) : null}
                </p>
            </header>

            <nav aria-label="Club sections" className={styles.tabs}>
                {clubNavigation(projection.club.id, 'manage').map((item) => (
                    <a
                        aria-current={item.current ? 'page' : undefined}
                        href={item.href}
                        key={item.label}
                    >
                        {item.label}
                    </a>
                ))}
            </nav>

            {role !== 'ADMIN' ? (
                <p className={styles.notice}>
                    You can review this Club&apos;s settings. Only the Club Admin can change them.
                </p>
            ) : null}
            {!active ? (
                <p className={styles.notice}>
                    This Club is archived. History remains visible, but ordinary changes are paused.
                </p>
            ) : null}

            <div className={styles.grid}>
                <ClubInfoCard projection={projection} />
                <VisibilityCard projection={projection} />
                <AvatarCard projection={projection} />
                <DangerZone projection={projection} />
            </div>
        </main>
    );
}
