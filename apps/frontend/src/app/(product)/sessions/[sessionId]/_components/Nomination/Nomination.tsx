'use client';

import type { TNominationMovie, TNominations } from '@pickflick/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import MoviePicker from '@/components/sessions/MoviePicker/MoviePicker';
import Button from '@/components/ui/Button/Button';
import Modal from '@/components/ui/Modal/Modal';
import TextInput from '@/components/ui/TextInput/TextInput';

import {
    closeNominationsAction,
    nominateAction,
    readNominationsAction,
} from '../../nomination-actions';
import styles from './Nomination.module.scss';

export default function Nomination({
    sessionId,
    initial,
}: {
    sessionId: string;
    initial: TNominations;
}) {
    const router = useRouter();
    const [updated, setUpdated] = useState<{ initial: TNominations; data: TNominations } | null>(
        null,
    );
    const data = updated?.initial === initial ? updated.data : initial;
    const [selected, setSelected] = useState<string | null>(null);
    const [suggestion, setSuggestion] = useState<TNominationMovie | null>(null);
    const [message, setMessage] = useState('');
    const [dialog, setDialog] = useState(false);
    const [confirmation, setConfirmation] = useState('');
    const [pending, startTransition] = useTransition();
    function run(action: 'submit' | 'refresh' | 'close') {
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
                    version: data.version,
                    confirmation,
                });
            else request = readNominationsAction(sessionId);
            const result = await request.catch(() => ({
                ok: false as const,
                message: 'We could not reach PickFlick. Try again.',
            }));
            if (!result.ok) {
                setMessage(result.message);
                return;
            }
            setUpdated({ initial, data: result.data });
            const messages = {
                submit: 'Your nomination is confirmed.',
                close: 'Nominations closed.',
                refresh: 'Nominations refreshed.',
            };
            setMessage(messages[action]);
            if (action === 'close') setDialog(false);
            if (action !== 'submit') router.refresh();
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
                    <h2 id="nominate-heading">Find &amp; Nominate a Movie</h2>
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
                            onClick={() => {
                                setConfirmation('');
                                setDialog(true);
                            }}
                        >
                            Close nominations early
                        </Button>
                    ) : null}
                </section>
            </div>
            <p aria-atomic="true" aria-live="polite" role="status">
                {message}
            </p>
            <Modal
                open={dialog}
                title="Close nominations early"
                dismissible={!pending}
                onClose={() => setDialog(false)}
                actions={
                    <>
                        <Button
                            variant="secondary"
                            disabled={pending}
                            onClick={() => setDialog(false)}
                        >
                            Keep nominations open
                        </Button>
                        <Button
                            loading={pending}
                            disabled={confirmation !== 'CLOSE'}
                            onClick={() => run('close')}
                        >
                            Confirm close
                        </Button>
                    </>
                }
            >
                <p>
                    End Nomination now? One nomination selects that Movie for Watching. Two or more
                    open Selection. Remaining participants cannot nominate.
                </p>
                <TextInput
                    id="close-nomination-confirmation"
                    label="Type CLOSE to confirm"
                    value={confirmation}
                    disabled={pending}
                    onChange={(event) => setConfirmation(event.currentTarget.value)}
                />
                <p role="status">{message}</p>
            </Modal>
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
