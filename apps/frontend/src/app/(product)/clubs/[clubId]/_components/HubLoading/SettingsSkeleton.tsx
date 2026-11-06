import type { IClubHub } from '@pickflick/contracts';

import {
    formatHubSessionTitle,
    formatRatingProgress,
    formatSessionPhase,
    formatSessionProgress,
} from '#components/sessions/club-session-text';
import Skeleton from '#components/ui/Skeleton/Skeleton';
import { formatCalendarDate } from '#lib/format';

import styles from './SettingsSkeleton.module.scss';

const CHECK_LABELS = [
    'Show who nominated each film',
    'Show each member’s Selection scores',
    'Show individual ratings',
];
const SESSION_KINDS = ['active', 'ratings'] as const;

export default function SettingsSkeleton({ hub }: { hub?: IClubHub | null }) {
    const canEdit = hub?.permissions.manageSettings;
    const canManageRoles = hub?.permissions.manageRoles;
    return (
        <div className={styles.layout}>
            {hub && hub.club.membershipRole !== 'ADMIN' ? (
                <p className={styles.notice}>
                    <Skeleton text="You can review this Club's settings. Only the Club Admin can change them." />
                </p>
            ) : null}
            <div className={styles.sessionCards}>
                {SESSION_KINDS.map((kind) => (
                    <section className={styles.card} key={kind}>
                        <Title />
                        <SessionSummary hub={hub} kind={kind} />
                    </section>
                ))}
            </div>
            <div className={styles.grid}>
                <section className={styles.card}>
                    <Title />
                    <div className={styles.form}>
                        <div className={styles.identity}>
                            <div className={styles.avatar}>
                                <Skeleton shouldFill />
                            </div>
                            <Field />
                        </div>
                        <Field isTextarea />
                        {canEdit ? <Save /> : null}
                    </div>
                </section>
                <section className={styles.card}>
                    <Title />
                    <div className={styles.form}>
                        <div>
                            <div className={styles.tabs}>
                                <Skeleton variant="control" />
                                <Skeleton variant="control" />
                            </div>
                            <div className={styles.checks}>
                                {CHECK_LABELS.map((label) => (
                                    <div className={styles.check} key={label}>
                                        <span className={styles.checkLabel}>
                                            <Skeleton text={label} />
                                        </span>
                                        <div>
                                            <Skeleton shouldFill />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className={styles.scale}>
                            <div className={styles.rangeLabel}>
                                <Skeleton text="Selection score range" />
                            </div>
                            <div className={styles.rangeRow}>
                                <div className={styles.range}>
                                    <Skeleton shouldFill />
                                </div>
                                <div className={styles.rangeValue}>
                                    <Skeleton variant="control" />
                                </div>
                            </div>
                        </div>
                        {canEdit ? <Save /> : null}
                    </div>
                </section>
                <section className={styles.card}>
                    <Title />
                    {hub?.permissions.manageMembers || canManageRoles ? (
                        <div className={styles.actions}>
                            <Skeleton variant="control" width="half" />
                            {canManageRoles ? <Skeleton variant="control" width="short" /> : null}
                        </div>
                    ) : (
                        <Skeleton width="half" />
                    )}
                </section>
                <section className={styles.card}>
                    <Title />
                    <div className={styles.actions}>
                        <Skeleton variant="control" width="half" />
                        {hub?.club.membershipRole === 'ADMIN' ? (
                            <Skeleton variant="control" width="short" />
                        ) : null}
                    </div>
                </section>
            </div>
        </div>
    );
}

function SessionSummary({ hub, kind }: { hub?: IClubHub | null; kind: 'active' | 'ratings' }) {
    if (kind === 'ratings') return <RatingSummaries hub={hub} />;
    if (!hub?.activeSession)
        return (
            <p className={styles.summaryLine}>
                <Skeleton text="No active Session." />
            </p>
        );
    const active = hub.activeSession;
    return (
        <div className={styles.summaryStack}>
            <div className={styles.copy}>
                <p className={styles.summaryLine}>
                    <Skeleton
                        text={`Current phase: ${formatSessionPhase(active.phase)} — ${formatSessionProgress(active, hub.memberCount)}`}
                    />
                </p>
                <div className={styles.progress}>
                    <Skeleton shouldFill />
                </div>
            </div>
            <ActiveActions hub={hub} />
        </div>
    );
}

function ActiveActions({ hub }: { hub: IClubHub }) {
    if (!hub.permissions.manageSessions) return <Skeleton variant="control" />;
    const active = hub.activeSession;
    return (
        <div className={styles.activeActions}>
            {active && (active.phase !== 'NOMINATION' || active.progressCount) ? (
                <Skeleton variant="control" />
            ) : null}
            <div className={styles.dangerActions}>
                <Skeleton variant="control" />
                <Skeleton variant="control" />
            </div>
        </div>
    );
}

function RatingSummaries({ hub }: { hub?: IClubHub | null }) {
    if (!hub?.ratingSessions.length)
        return (
            <p className={styles.summaryLine}>
                <Skeleton text="No Sessions awaiting ratings." />
            </p>
        );
    return (
        <div>
            {hub.ratingSessions.map((session) => (
                <div className={styles.ratingSummary} key={session.id}>
                    <div className={styles.ratingCopy}>
                        <strong>
                            <Skeleton text={formatHubSessionTitle(session)} />
                        </strong>
                        <span>
                            <Skeleton
                                text={`${session.scheduledAt ? formatCalendarDate(session.scheduledAt) : 'Not scheduled'} · ${formatRatingProgress(session)}`}
                            />
                        </span>
                    </div>
                    {hub.permissions.manageSessions ? (
                        <div className={styles.ratingAction}>
                            <Skeleton variant="control" />
                        </div>
                    ) : null}
                </div>
            ))}
        </div>
    );
}
function Title() {
    return (
        <div className={styles.title}>
            <Skeleton width="half" shouldFill />
        </div>
    );
}
function Save() {
    return (
        <div className={styles.save}>
            <Skeleton variant="control" />
        </div>
    );
}
function Field({ isTextarea = false }: { isTextarea?: boolean }) {
    return (
        <div className={styles.field}>
            <div className={styles.label}>
                <Skeleton width="short" shouldFill />
            </div>
            <div className={styles.input} data-textarea={isTextarea || undefined}>
                <Skeleton shouldFill />
            </div>
            <div className={styles.message} />
        </div>
    );
}
