import {
    type IClubHub,
    type IClubHubSession,
    type IClubSummary,
    isBlockingSessionPhase,
} from '@pickflick/contracts';
import Link from 'next/link';

import { selectClubAction } from '@/app/(product)/app/actions';
import ClubStatus from '@/components/clubs/ClubStatus/ClubStatus';
import { clubNavigation } from '@/components/shells/shell-navigation';
import ButtonLink from '@/components/ui/Button/ButtonLink';
import { monogram } from '@/lib/format';

import styles from '../../page.module.scss';

interface IHubOverviewProps {
    clubs: IClubSummary[];
    hub: IClubHub;
}

function sessionName(session: IClubHubSession): string {
    return session.topic ?? 'Untitled Session';
}

function sessionDate(value: string): string {
    return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' }).format(
        new Date(value),
    );
}

function sessionTime(value: string): string {
    return `${new Intl.DateTimeFormat('en', { timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value))} UTC`;
}

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
                    {monogram(club.name)}
                </span>
                <span className={styles.clubName}>{club.name}</span>
                <span className={styles.clubRole}>{club.membershipRole.toLowerCase()}</span>
            </button>
        </form>
    );
}

function clubChoices(clubs: IClubSummary[], current: IClubSummary): IClubSummary[] {
    return clubs.some(({ id }) => id === current.id)
        ? clubs.map((club) => (club.id === current.id ? current : club))
        : [current, ...clubs];
}

function callSheetPhase(session?: IClubHubSession): string {
    return session ? `Current phase / ${session.phase.toLowerCase()}` : 'Awaiting a Session';
}

export default function HubOverview({ clubs, hub }: IHubOverviewProps) {
    const { club, activeSession } = hub;
    const canCreate =
        hub.permissions.manageSessions && !isBlockingSessionPhase(activeSession?.phase);
    const choices = clubChoices(clubs, club);
    const currentIndex = choices.findIndex(({ id }) => id === club.id);
    const previous =
        choices.length > 1
            ? choices[(currentIndex - 1 + choices.length) % choices.length]
            : undefined;
    const next = choices.length > 1 ? choices[(currentIndex + 1) % choices.length] : undefined;
    return (
        <main className={styles.hub}>
            <div className={styles.stage}>
                <nav aria-label="Switch Club" className={styles.switcher}>
                    <div className={styles.switcherHeader}>
                        <p className={styles.eyebrow}>Your Clubs</p>
                        <Link href="/clubs/new">Create a Club</Link>
                    </div>
                    <div className={styles.carousel}>
                        <ClubArrow club={previous} label="Previous Club" direction="←" />
                        <div className={styles.clubChoices}>
                            {choices.map((choice) => (
                                <ClubChoice
                                    club={choice}
                                    current={choice.id === club.id}
                                    key={choice.id}
                                />
                            ))}
                        </div>
                        <ClubArrow club={next} label="Next Club" direction="→" />
                    </div>
                </nav>

                <section aria-labelledby="hub-title" className={styles.callSheet}>
                    <div className={styles.callSheetHeader}>
                        <span>Screening Call Sheet</span>
                        <span>{callSheetPhase(activeSession)}</span>
                    </div>
                    <div className={styles.callSheetBody}>
                        <div>
                            <p className={styles.eyebrow}>
                                {club.lifecycle === 'ARCHIVED' ? 'Archived Club' : 'Now showing'}
                            </p>
                            <h1 id="hub-title">{club.name}</h1>
                            <p className={styles.description}>
                                {club.description ?? 'Your private screening room.'}
                            </p>
                            <p className={styles.clubMeta}>
                                <span>{club.tier === 'FREE' ? 'Free Club' : 'Pro Club'}</span>
                                <span>
                                    Selection scale{' '}
                                    <b>
                                        {club.selectionScaleMin}–{club.selectionScaleMax}
                                    </b>
                                </span>
                                <span>
                                    {club.membershipRole === 'ADMIN'
                                        ? 'Admin'
                                        : club.membershipRole}
                                </span>
                            </p>
                            {activeSession ? (
                                <dl className={styles.callFacts}>
                                    <div>
                                        <dt>Session</dt>
                                        <dd>{sessionName(activeSession)}</dd>
                                    </div>
                                    <div>
                                        <dt>Date</dt>
                                        <dd>
                                            {activeSession.scheduledAt
                                                ? sessionDate(activeSession.scheduledAt)
                                                : 'To be announced'}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>Call time</dt>
                                        <dd>
                                            {activeSession.scheduledAt
                                                ? sessionTime(activeSession.scheduledAt)
                                                : 'To be announced'}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>Location</dt>
                                        <dd>{activeSession.location ?? 'To be announced'}</dd>
                                    </div>
                                </dl>
                            ) : (
                                <p className={styles.emptyCall}>
                                    No active Session is on the Call Sheet yet.
                                </p>
                            )}
                        </div>
                        <div aria-hidden="true" className={styles.callArt}>
                            <span>PF</span>
                        </div>
                    </div>
                </section>
            </div>

            <ClubStatus access={hub.access} />

            <nav aria-label="Club sections" className={styles.tabs}>
                {clubNavigation(club.id, 'overview').map((item) => (
                    <Link
                        aria-current={item.current ? 'page' : undefined}
                        href={item.href}
                        key={item.label}
                    >
                        {item.label}
                    </Link>
                ))}
            </nav>

            <div className={styles.overview}>
                {canCreate ? (
                    <ButtonLink href={`/clubs/${club.id}/sessions/new`} variant="primary">
                        Create Session
                    </ButtonLink>
                ) : null}
                <section aria-label="Club statistics" className={styles.stats}>
                    <div>
                        <strong>{hub.memberCount}</strong>
                        <span>Members</span>
                    </div>
                    <div>
                        <strong>{hub.sessionCount}</strong>
                        <span>Sessions</span>
                    </div>
                    <div>
                        <strong>{hub.completedSessionCount}</strong>
                        <span>Completed Sessions</span>
                    </div>
                </section>
                <div className={styles.cards}>
                    <section className={styles.card}>
                        <h2>Members</h2>
                        <p>{hub.memberCount} members in this Club</p>
                        <p className={styles.quiet}>
                            Your role: {club.membershipRole.toLowerCase()}
                        </p>
                    </section>
                    <section className={styles.card}>
                        <h2>Active Session</h2>
                        {activeSession ? (
                            <>
                                <p>
                                    <Link href={`/sessions/${activeSession.id}`}>
                                        {sessionName(activeSession)}
                                    </Link>
                                </p>
                                <p className={styles.quiet}>
                                    Phase: {activeSession.phase.toLowerCase()}
                                </p>
                            </>
                        ) : (
                            <p className={styles.quiet}>
                                No active Session. Your next screening will appear here.
                            </p>
                        )}
                    </section>
                </div>
                <SessionRows
                    title="Active Ratings"
                    sessions={hub.ratingSessions}
                    empty="No Sessions awaiting ratings."
                />
                <SessionRows
                    title="Session history"
                    sessions={hub.historySessions}
                    empty="No completed or cancelled Sessions yet."
                />
                <section className={styles.card}>
                    <h2>Recent Activity</h2>
                    {hub.recentSessions.length > 0 ? (
                        <ul className={styles.activity}>
                            {hub.recentSessions.map((session) => (
                                <li key={session.id}>
                                    <span>
                                        <Link href={`/sessions/${session.id}`}>
                                            {sessionName(session)}
                                        </Link>{' '}
                                        · {session.phase.toLowerCase()}
                                    </span>
                                    <time dateTime={session.updatedAt}>
                                        {sessionDate(session.updatedAt)}
                                    </time>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className={styles.quiet}>No Session activity yet.</p>
                    )}
                </section>
            </div>
        </main>
    );
}

function SessionRows({
    title,
    sessions,
    empty,
}: {
    title: string;
    sessions: IClubHubSession[];
    empty: string;
}) {
    return (
        <section className={styles.card}>
            <h2>{title}</h2>
            {sessions.length ? (
                <ul className={styles.activity}>
                    {sessions.map((session) => (
                        <li key={session.id}>
                            <Link href={`/sessions/${session.id}`}>{sessionName(session)}</Link>
                            <span>{session.phase.toLowerCase()}</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className={styles.quiet}>{empty}</p>
            )}
        </section>
    );
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
