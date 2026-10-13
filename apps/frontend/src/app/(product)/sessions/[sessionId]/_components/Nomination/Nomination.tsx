'use client';

import type { TNominationMovie, TNominations } from '@pickflick/contracts';
import Link from 'next/link';
import { useRef, useState, useTransition } from 'react';

import MoviePicker from '@/components/sessions/MoviePicker/MoviePicker';
import Button from '@/components/ui/Button/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog/ConfirmDialog';

import {
    closeNominationsAction,
    nominateAction,
    refreshNominationsAction,
} from '../../nomination-actions';
import styles from './Nomination.module.scss';

export default function Nomination({
    sessionId,
    data,
    phaseVersion,
}: {
    sessionId: string;
    data: TNominations;
    phaseVersion: number;
}) {
    const headingRef = useRef<HTMLHeadingElement>(null);
    const [selected, setSelected] = useState<string | null>(null);
    const [suggestion, setSuggestion] = useState<TNominationMovie | null>(null);
    const [message, setMessage] = useState('');
    const [dialog, setDialog] = useState(false);
    const [pending, startTransition] = useTransition();
    function run(action: 'submit' | 'refresh' | 'close', confirmation = '') {
        if (!navigator.onLine) {
            setMessage(
                'You appear to be offline. Reconnect before continuing; your selection is still here.',
            );
            return;
        }
        setMessage(action === 'refresh' ? 'Refreshing nominations…' : 'Saving…');
        startTransition(async () => {
            let request;
            if (action === 'submit') request = nominateAction(sessionId, { movieId: selected });
            else if (action === 'close')
                request = closeNominationsAction(sessionId, {
                    phaseVersion,
                    confirmation,
                });
            else request = refreshNominationsAction(sessionId);
            const result = await request.catch(() => ({
                ok: false as const,
                message: 'We could not reach PickFlick. Try again.',
            }));
            if (!result.ok) {
                setMessage(result.message);
                return;
            }
            setMessage(result.message);
            if (action === 'close') setDialog(false);
            if (action === 'submit') headingRef.current?.focus();
        });
    }
    return (
        <section className={styles.nomination} aria-label="Movie nomination">
            <div className={styles.progress}>
                <p role="status">
                    {data.nominatedCount} of {data.acceptedCount} participants have nominated.
                </p>
                <progress
                    aria-label="Nomination progress"
                    value={data.nominatedCount}
                    max={Math.max(data.acceptedCount, 1)}
                />
                <Button variant="ghost" disabled={pending} onClick={() => run('refresh')}>
                    Refresh nominations
                </Button>
            </div>
            <div className={styles.columns}>
                <section className={styles.card} aria-labelledby="nominate-heading">
                    <h2 id="nominate-heading" ref={headingRef} tabIndex={-1}>
                        Find &amp; Nominate a Movie
                    </h2>
                    {data.canSubmit ? (
                        <>
                            {suggestion ? (
                                <div className={styles.selected}>
                                    <p>Selected: {movieLabel(suggestion)}</p>
                                    <Button
                                        disabled={pending}
                                        variant="ghost"
                                        onClick={() => {
                                            setSuggestion(null);
                                            setSelected(null);
                                        }}
                                    >
                                        Remove selected Movie
                                    </Button>
                                </div>
                            ) : (
                                <MoviePicker
                                    disabled={pending}
                                    value={selected}
                                    onChange={setSelected}
                                />
                            )}
                            <Button
                                disabled={!selected}
                                loading={pending}
                                onClick={() => run('submit')}
                            >
                                Nominate This
                            </Button>
                            <h3>Suggestions from your past nominations that did not win</h3>
                            {data.suggestions.length ? (
                                <ul
                                    className={styles.suggestions}
                                    aria-label="Personal nomination suggestions"
                                >
                                    {data.suggestions.map((movie) => (
                                        <li key={movie.id}>
                                            <button
                                                type="button"
                                                disabled={pending}
                                                onClick={() => {
                                                    setSelected(movie.id);
                                                    setSuggestion(movie);
                                                }}
                                            >
                                                <span className={styles.poster} aria-hidden="true">
                                                    PF
                                                </span>
                                                <strong>{movieLabel(movie)}</strong>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p>
                                    No past losing nominations in this Club yet. Search for a Movie
                                    above.
                                </p>
                            )}
                        </>
                    ) : (
                        <SubmissionState movie={data.ownMovie} />
                    )}
                </section>
                <section className={styles.card} aria-labelledby="nominations-heading">
                    <h2 id="nominations-heading">Current Nominations</h2>
                    <NominationList data={data} />
                    {data.canClose ? (
                        <Button
                            variant="secondary"
                            disabled={pending}
                            onClick={() => setDialog(true)}
                        >
                            Close nominations early
                        </Button>
                    ) : null}
                </section>
            </div>
            <p aria-atomic="true" aria-live="polite" role="status">
                {message}
            </p>
            <ConfirmDialog
                cancelLabel="Keep nominations open"
                confirmLabel="Confirm close"
                inputId="close-nomination-confirmation"
                onClose={() => setDialog(false)}
                onConfirm={(confirmation) => run('close', confirmation)}
                open={dialog}
                pending={pending}
                status={<p role="status">{message}</p>}
                title="Close nominations early"
                tone="neutral"
                word="CLOSE"
            >
                <p>
                    End Nomination now? One nomination selects that Movie for Watching. Two or more
                    open Selection. Remaining participants cannot nominate.
                </p>
            </ConfirmDialog>
        </section>
    );
}
function movieLabel(movie: TNominationMovie) {
    const year = movie.year ? ` (${movie.year})` : '';
    return `${movie.title ?? 'Movie title unavailable'}${year}`;
}

function SubmissionState({ movie }: { movie: TNominationMovie | null }) {
    if (!movie)
        return (
            <p>
                Only accepted participants can nominate while Nomination is open in an active Club.
            </p>
        );
    return (
        <p role="status">
            Your nomination: <Link href={`/movies/${movie.id}`}>{movieLabel(movie)}</Link>. Your
            submission is locked.
        </p>
    );
}
function NominationList({ data }: { data: TNominations }) {
    if (data.hidden) return <p>Nominations are hidden until you submit your own Movie.</p>;
    if (!data.nominations.length) return <p>No nominations yet.</p>;
    return (
        <ul className={styles.movies}>
            {data.nominations.map((row, index) => (
                <li key={`${row.movie.id}-${index}`}>
                    <span className={styles.poster} aria-hidden="true">
                        PF
                    </span>
                    <div>
                        <Link href={`/movies/${row.movie.id}`}>{movieLabel(row.movie)}</Link>
                        {row.author !== null ? <p>by {row.author}</p> : null}
                    </div>
                </li>
            ))}
        </ul>
    );
}
