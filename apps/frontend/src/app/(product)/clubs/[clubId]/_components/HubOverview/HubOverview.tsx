import type { IClubHub, IClubHubSession, IClubSummary } from '@pickflick/contracts';
import Link from 'next/link';

import { selectClubAction } from '@/app/(product)/app/actions';
import ClubStatus from '@/components/clubs/ClubStatus/ClubStatus';

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
                    {club.name.slice(0, 2).toUpperCase()}
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
    const choices = clubChoices(clubs, club);
    const currentIndex = choices.findIndex(({ id }) => id === club.id);
    const previous = choices[(currentIndex - 1 + choices.length) % choices.length];
    const next = choices[(currentIndex + 1) % choices.length];
    return (
        <main className={styles.hub}>
            <div className={styles.stage}>
                <nav aria-label="Switch Club" className={styles.switcher}>
                    <div className={styles.switcherHeader}>
                        <p className={styles.eyebrow}>Your Clubs</p>
                        <Link href="/clubs/new">Create a Club</Link>
                    </div>
                    <div className={styles.carousel}>
                        {choices.length > 1 && previous ? (
                            <form action={selectClubAction}>
                                <input name="clubId" type="hidden" value={previous.id} />
                                <button
                                    aria-label="Previous Club"
                                    className={styles.arrow}
                                    type="submit"
                                >
                                    ←
                                </button>
                            </form>
                        ) : null}
                        <div className={styles.clubChoices}>
                            {choices.map((choice) => (
                                <ClubChoice
                                    club={choice}
                                    current={choice.id === club.id}
                                    key={choice.id}
                                />
                            ))}
                        </div>
                        {choices.length > 1 && next ? (
                            <form action={selectClubAction}>
                                <input name="clubId" type="hidden" value={next.id} />
                                <button
                                    aria-label="Next Club"
                                    className={styles.arrow}
                                    type="submit"
                                >
                                    →
                                </button>
                            </form>
                        ) : null}
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
                <Link aria-current="page" href={`/clubs/${club.id}`}>
                    Overview
                </Link>
                <Link href={`/clubs/${club.id}/members`}>Members</Link>
                <Link href={`/clubs/${club.id}/settings`}>Manage Club</Link>
            </nav>

            <div className={styles.overview}>
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
                                <p>{sessionName(activeSession)}</p>
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
                <section className={styles.card}>
                    <h2>Recent Activity</h2>
                    {hub.recentSessions.length > 0 ? (
                        <ul className={styles.activity}>
                            {hub.recentSessions.map((session) => (
                                <li key={session.id}>
                                    <span>
                                        {sessionName(session)} · {session.phase.toLowerCase()}
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
