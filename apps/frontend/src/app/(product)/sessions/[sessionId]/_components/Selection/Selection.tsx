'use client';

import { useForm } from '@mantine/form';
import {
    getPosterPath,
    submitSelectionSchema,
    type TNominationMovie,
    type TSelection,
} from '@pickflick/contracts';
import Link from 'next/link';
import { type ReactNode, useRef } from 'react';

import SearchPoster from '#components/movies/SearchPoster/SearchPoster';
import { submitSelectionAction } from '#components/sessions/selection-actions';
import Button from '#components/ui/Button/Button';
import ColorReveal from '#components/ui/ColorReveal/ColorReveal';
import Icon from '#components/ui/Icon/Icon';
import InfoTip from '#components/ui/InfoTip/InfoTip';
import ScoreControl from '#components/ui/ScaleControl/ScoreControl';
import Skeleton from '#components/ui/Skeleton/Skeleton';
import StatusLine from '#components/ui/StatusLine/StatusLine';
import { formatMovieTitle } from '#lib/format';
import { useActionStatus } from '#lib/use-action-status';

import PhaseProgress from '../PhaseProgress/PhaseProgress';
import styles from './Selection.module.scss';

export default function Selection({
    sessionId,
    data,
    header,
    isLoading = false,
}: {
    sessionId: string;
    data: TSelection;
    header: ReactNode;
    isLoading?: boolean;
}) {
    const headingRef = useRef<HTMLHeadingElement>(null);
    const { message, isSuccess, setMessage, announceSuccess, isPending, run } = useActionStatus();
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
    const isSubmitted = Boolean(data.submittedAt);
    const canScore = data.canSubmit && !isSubmitted;
    function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
        form.onSubmit(
            (values) => {
                run(() => submitSelectionAction(sessionId, values), {
                    pendingMessage: 'Saving your ballot…',
                    unreachableMessage:
                        'We could not reach PickFlick. Your scores are still here; try again.',
                    onResult: (result) => {
                        if (!result.ok) return setMessage(result.message);
                        announceSuccess('Ballot submitted.');
                        headingRef.current?.focus();
                    },
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
    return (
        <section className={styles.selection} aria-labelledby="selection-heading">
            <PhaseProgress>
                Selection in progress — {data.submittedCount} of {data.acceptedCount} participants
                have submitted.
            </PhaseProgress>
            {header}
            <div className={styles.intro}>
                <div className={styles.headingRow}>
                    <div className={styles.headingGroup}>
                        <h2 id="selection-heading" ref={headingRef} tabIndex={-1}>
                            {data.canSubmit || isSubmitted ? 'Your scores' : 'Nominated films'}
                        </h2>
                        <InfoTip label="About scoring">
                            Score every film from {data.scaleMin} to {data.scaleMax}. You submit
                            once; scores cannot be changed afterwards.
                        </InfoTip>
                    </div>
                    {canScore && data.nominations.length ? (
                        <ScoredProgress scoredCount={scoredCount} total={data.nominations.length} />
                    ) : null}
                </div>
                <SubmissionStatus isSubmitted={isSubmitted} canSubmit={data.canSubmit} />
            </div>
            {!data.nominations.length ? (
                <p>No nominations are available for Selection.</p>
            ) : (
                <form onSubmit={handleSubmit} noValidate>
                    <ul className={styles.movies} aria-label="Nominated films">
                        {data.nominations.map((row, index) => (
                            <li
                                key={row.id}
                                className={styles.movie}
                                data-color-reveal-trigger
                                data-color-reveal-surface
                            >
                                <ColorReveal variant="surface" />
                                <SelectionMovie
                                    movie={row.movie}
                                    author={row.author}
                                    isLoading={isLoading}
                                />
                                <div className={styles.control}>
                                    <ScoreControl
                                        isCompact
                                        isLoading={isLoading}
                                        label={`Score for ${formatMovieTitle(row.movie)}`}
                                        name={`score-${row.id}`}
                                        min={data.scaleMin}
                                        max={data.scaleMax}
                                        value={
                                            isSubmitted
                                                ? (row.ownScore ?? undefined)
                                                : form.values.scores[index]?.score
                                        }
                                        onChange={(score) =>
                                            form.setFieldValue(`scores.${index}.score`, score)
                                        }
                                        disabled={isPending || (!data.canSubmit && !isSubmitted)}
                                        isSubmitted={isSubmitted}
                                    />
                                </div>
                            </li>
                        ))}
                    </ul>
                    {canScore ? (
                        <div className={styles.submit}>
                            <Button type="submit" loading={isPending} disabled={isLoading}>
                                {isLoading ? <Skeleton text="Submit scores" /> : 'Submit scores'}
                            </Button>
                        </div>
                    ) : null}
                    <StatusLine
                        className={styles.feedback}
                        isSuccess={isSuccess}
                        message={message}
                    />
                </form>
            )}
        </section>
    );
}

function SelectionMovie({
    movie,
    author,
    isLoading,
}: {
    movie: TNominationMovie;
    author: string | null;
    isLoading: boolean;
}) {
    const title = formatMovieTitle(movie);
    return (
        <Link className={styles.film} href={`/movies/${movie.id}`} prefetch={false}>
            <SearchPoster
                className={styles.poster}
                url={getPosterPath(movie.id)}
                withColorReveal
                isLoading={isLoading}
            />
            <div className={styles.info}>
                <div className={styles.filmHeading}>
                    <h3>{isLoading ? <Skeleton text={title} /> : title}</h3>
                    {movie.year !== null ? (
                        <span className={styles.year}>
                            {isLoading ? <Skeleton text={movie.year} /> : movie.year}
                        </span>
                    ) : null}
                </div>
                {author !== null ? (
                    <p>{isLoading ? <Skeleton text={`by ${author}`} /> : <>by {author}</>}</p>
                ) : null}
                {movie.genres.length ? (
                    <ul className={styles.genres} aria-label="Genres">
                        {movie.genres.slice(0, MAX_GENRES).map((genre) => (
                            <li key={genre}>{isLoading ? <Skeleton text={genre} /> : genre}</li>
                        ))}
                    </ul>
                ) : null}
            </div>
        </Link>
    );
}

const MAX_GENRES = 2;

function ScoredProgress({ scoredCount, total }: { scoredCount: number; total: number }) {
    return (
        <p className={styles.progress} role="status" aria-atomic="true">
            <span aria-hidden="true">
                {scoredCount}/{total}
            </span>
            <span className="visually-hidden">
                {scoredCount} of {total} films scored.
                {scoredCount === total ? ' Ready to submit.' : ''}
            </span>
        </p>
    );
}

function SubmissionStatus({
    isSubmitted,
    canSubmit,
}: {
    isSubmitted: boolean;
    canSubmit: boolean;
}) {
    if (isSubmitted)
        return (
            <p className={styles.confirmation} role="status">
                <Icon name="check" />
                <span>Submitted · Waiting for other participants</span>
            </p>
        );
    if (canSubmit) return <p>Score every film to help choose what we watch.</p>;
    return null;
}
