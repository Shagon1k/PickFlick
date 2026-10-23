'use client';

import { useForm } from '@mantine/form';
import {
    submitSelectionSchema,
    type TNominationMovie,
    type TSelection,
} from '@pickflick/contracts';
import Link from 'next/link';
import { type ReactNode, useRef, useState, useTransition } from 'react';

import SearchPoster from '#components/movies/SearchPoster/SearchPoster';
import Button from '#components/ui/Button/Button';
import ScoreControl from '#components/ui/ScaleControl/ScoreControl';
import { getOfflineMessage } from '#lib/offline';

import { refreshSelectionAction, submitSelectionAction } from '../../selection-actions';
import PhaseProgress from '../PhaseProgress/PhaseProgress';
import styles from './Selection.module.scss';

export default function Selection({
    sessionId,
    data,
    header,
}: {
    sessionId: string;
    data: TSelection;
    header: ReactNode;
}) {
    const headingRef = useRef<HTMLHeadingElement>(null);
    const [message, setMessage] = useState('');
    const [isPending, startTransition] = useTransition();
    const form = useForm<{ scores: { nominationId: string; score: number | undefined }[] }>({
        initialValues: {
            scores: data.nominations.map((row) => ({ nominationId: row.id, score: undefined })),
        },
        validate: (values) =>
            submitSelectionSchema.safeParse(values).success
                ? {}
                : { scores: 'Choose a score for every nomination.' },
    });
    const scoredCount = form.values.scores.filter((row) => row.score !== undefined).length;
    function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
        form.onSubmit(
            (values) => {
                const offline = getOfflineMessage();
                if (offline) {
                    setMessage(offline);
                    return;
                }
                setMessage('Saving your ballot…');
                startTransition(async () => {
                    const result = await submitSelectionAction(sessionId, values).catch(() => ({
                        ok: false as const,
                        message:
                            'We could not reach PickFlick. Your scores are still here; try again.',
                    }));
                    setMessage(result.ok ? 'Ballot submitted.' : result.message);
                    if (result.ok) headingRef.current?.focus();
                });
            },
            (_errors, _values, event) => {
                setMessage('Choose a score for every nomination.');
                const firstMissing = form.values.scores.findIndex((row) => row.score === undefined);
                event?.currentTarget
                    .querySelectorAll('[role="radiogroup"]')
                    [firstMissing]?.querySelector<HTMLButtonElement>('[tabindex="0"]')
                    ?.focus();
            },
        )(event);
    }
    function handleRefresh() {
        const offline = getOfflineMessage();
        if (offline) {
            setMessage(offline);
            return;
        }
        startTransition(async () => {
            try {
                await refreshSelectionAction(sessionId);
                setMessage('Selection refreshed.');
            } catch {
                setMessage('We could not refresh Selection. Try again.');
            }
        });
    }
    return (
        <section className={styles.selection} aria-labelledby="selection-heading">
            <PhaseProgress
                refreshLabel="Refresh Selection"
                disabled={isPending}
                onRefresh={handleRefresh}
            >
                Selection in progress — {data.submittedCount} of {data.acceptedCount} participants
                have submitted.
            </PhaseProgress>
            {header}
            <h2 className="visually-hidden" id="selection-heading" ref={headingRef} tabIndex={-1}>
                Score nominated films
            </h2>
            <p>
                Score every nominated film from {data.scaleMin} to {data.scaleMax}. Submit once;
                your scores cannot be changed.
            </p>
            {!data.nominations.length ? (
                <p>No nominations are available for Selection.</p>
            ) : (
                <form onSubmit={handleSubmit} noValidate>
                    <ul className={styles.movies} aria-label="Nominated films">
                        {data.nominations.map((row, index) => (
                            <li key={row.id} className={styles.movie}>
                                <SearchPoster
                                    className={styles.poster}
                                    url={`/api/movies/${row.movie.id}/poster`}
                                />
                                <div className={styles.info}>
                                    <h3>
                                        <Link href={`/movies/${row.movie.id}`}>
                                            {row.movie.title ?? 'Movie title unavailable'}
                                        </Link>
                                    </h3>
                                    <p>{describeNomination(row.movie, row.author)}</p>
                                </div>
                                <div className={styles.control}>
                                    <ScoreControl
                                        compact
                                        label={`Score for ${row.movie.title ?? 'unavailable Movie'}`}
                                        name={`score-${row.id}`}
                                        min={data.scaleMin}
                                        max={data.scaleMax}
                                        value={
                                            data.submittedAt
                                                ? (row.ownScore ?? undefined)
                                                : form.values.scores[index]?.score
                                        }
                                        onChange={(score) =>
                                            form.setFieldValue(`scores.${index}.score`, score)
                                        }
                                        disabled={
                                            isPending || (!data.canSubmit && !data.submittedAt)
                                        }
                                        submitted={Boolean(data.submittedAt)}
                                    />
                                </div>
                            </li>
                        ))}
                    </ul>
                    <div className={styles.submit}>
                        {data.submittedAt ? (
                            <p role="status">Your ballot is saved. Your scores are locked.</p>
                        ) : null}
                        {data.canSubmit && !data.submittedAt ? (
                            <>
                                <p className={styles.summary} role="status">
                                    {scoredCount} of {data.nominations.length} films scored ·{' '}
                                    {scoredCount === data.nominations.length
                                        ? 'Ready to submit'
                                        : 'Score every film to submit'}
                                </p>
                                <Button type="submit" loading={isPending}>
                                    Submit scores
                                </Button>
                            </>
                        ) : null}
                        {!data.canSubmit && !data.submittedAt ? (
                            <p>
                                Only accepted participants can submit while Selection is open in an
                                active Club.
                            </p>
                        ) : null}
                        <p aria-live="polite" aria-atomic="true" role="status">
                            {message}
                        </p>
                    </div>
                </form>
            )}
        </section>
    );
}

function describeNomination(movie: TNominationMovie, author: string | null) {
    return [
        movie.year,
        movie.genres.slice(0, MAX_GENRES).join(', '),
        author === null ? null : `nominated by ${author}`,
    ]
        .filter(Boolean)
        .join(' · ');
}

const MAX_GENRES = 2;
