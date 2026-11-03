'use client';

import type { TNominationMovie, TNominations } from '@pickflick/contracts';
import clsx from 'clsx';
import { type ReactNode, useRef, useState } from 'react';

import MoviePicker from '#components/sessions/MoviePicker/MoviePicker';
import NominationMovieCard from '#components/sessions/NominationMovieCard/NominationMovieCard';
import NominationMovieList from '#components/sessions/NominationMovieList/NominationMovieList';
import { nominateAction } from '#components/sessions/nomination-actions';
import Button from '#components/ui/Button/Button';
import Icon from '#components/ui/Icon/Icon';
import StatusLine from '#components/ui/StatusLine/StatusLine';
import { useActionStatus } from '#lib/use-action-status';

import PhaseProgress from '../PhaseProgress/PhaseProgress';
import styles from './Nomination.module.scss';
import NominationSuggestions from './NominationSuggestions';

const MAX_GENRES = 3;

export default function Nomination({
    sessionId,
    data,
    header,
}: {
    sessionId: string;
    data: TNominations;
    header: ReactNode;
}) {
    const headingRef = useRef<HTMLHeadingElement>(null);
    const [chosen, setChosen] = useState<TNominationMovie | null>(null);
    const { message, isSuccess, setMessage, announceSuccess, isPending, run } = useActionStatus();
    function handleSubmit() {
        run(() => nominateAction(sessionId, { movieId: chosen?.id }), {
            pendingMessage: 'Saving…',
            onResult: (result) => {
                if (result.ok) {
                    announceSuccess(result.message);
                    headingRef.current?.focus();
                } else setMessage(result.message);
            },
        });
    }
    return (
        <section className={styles.nomination} aria-label="Movie nomination">
            <PhaseProgress>
                {data.acceptedCount
                    ? `Nomination in progress — ${data.nominatedCount} of ${data.memberCount} members have nominated.`
                    : 'Nomination in progress — no one has joined yet.'}
            </PhaseProgress>
            {header}
            <div className={styles.columns}>
                {data.canSubmit || data.ownMovie ? (
                    <section
                        className={clsx(styles.card, !data.canSubmit && styles.submittedCard)}
                        aria-labelledby="nominate-heading"
                    >
                        <h2 id="nominate-heading" ref={headingRef} tabIndex={-1}>
                            {data.canSubmit ? 'Find & Nominate a Movie' : 'Your nomination'}
                        </h2>
                        {data.canSubmit ? (
                            <NominationPicker
                                chosen={chosen}
                                disabled={isPending}
                                onChoose={setChosen}
                                onSubmit={handleSubmit}
                            />
                        ) : (
                            <SubmissionState movie={data.ownMovie} />
                        )}
                        <StatusLine
                            className={styles.feedback}
                            isSuccess={isSuccess}
                            message={message}
                        />
                        {data.canSubmit ? (
                            <NominationSuggestions
                                past={data.suggestions}
                                watchlist={data.watchlist}
                                disabled={isPending}
                                onChoose={setChosen}
                            />
                        ) : null}
                    </section>
                ) : null}
                <section
                    className={`${styles.card} ${styles.currentCard}`}
                    aria-labelledby="nominations-heading"
                >
                    <h2 id="nominations-heading">Current Nominations</h2>
                    <NominationList data={data} />
                </section>
            </div>
        </section>
    );
}

function SubmissionState({ movie }: { movie: TNominationMovie | null }) {
    return movie ? (
        <>
            <p className={styles.submissionStatus}>
                <Icon name="check" />
                <span>Submitted · Waiting for selection</span>
            </p>
            <NominationMovieCard movie={movie} author={null} maxGenres={MAX_GENRES} />
        </>
    ) : null;
}

function NominationList({ data }: { data: TNominations }) {
    if (data.hidden)
        return (
            <p>
                {data.canSubmit
                    ? 'Nominations stay hidden until you nominate.'
                    : 'Nominations are hidden.'}
            </p>
        );
    if (!data.nominations.length) return <p>No nominations yet.</p>;
    return (
        <NominationMovieList label="Current nominations">
            {data.nominations.map((row, index) => (
                // eslint-disable-next-line @eslint-react/no-array-index-key -- several participants may nominate the same Movie; rows are only appended
                <li key={`${row.movie.id}-${index}`}>
                    <NominationMovieCard
                        movie={row.movie}
                        author={row.author}
                        maxGenres={MAX_GENRES}
                    />
                </li>
            ))}
        </NominationMovieList>
    );
}

function NominationPicker({
    chosen,
    disabled,
    onChoose,
    onSubmit,
}: {
    chosen: TNominationMovie | null;
    disabled: boolean;
    onChoose: (movie: TNominationMovie | null) => void;
    onSubmit: () => void;
}) {
    return (
        <MoviePicker
            disabled={disabled}
            isLabelHidden
            shouldReserveMessage={false}
            placeholder="Search films…"
            value={chosen?.id ?? null}
            selectedTitle={chosen?.title ?? 'Movie title unavailable'}
            onChange={(id, movie) =>
                onChoose(
                    id && movie
                        ? {
                              id,
                              title: movie.title ?? movie.originalTitle,
                              year: movie.releaseYear,
                              genres: movie.genres ?? [],
                          }
                        : null,
                )
            }
            endAction={
                <Button
                    aria-label="Nominate selected film"
                    title="Nominate selected film"
                    disabled={disabled || !chosen}
                    loading={disabled}
                    size="icon"
                    variant="subtle"
                    onClick={onSubmit}
                >
                    <span className={styles.nominateIcon} data-press-surface>
                        <Icon name="arrow-left" />
                    </span>
                </Button>
            }
        />
    );
}
