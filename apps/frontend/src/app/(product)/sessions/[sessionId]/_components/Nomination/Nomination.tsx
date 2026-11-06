'use client';

import type { TNominationMovie, TNominations } from '@pickflick/contracts';
import clsx from 'clsx';
import { type ReactNode, useRef, useState } from 'react';

import MoviePicker from '#components/sessions/MoviePicker/MoviePicker';
import { nominateAction } from '#components/sessions/nomination-actions';
import Button from '#components/ui/Button/Button';
import Icon from '#components/ui/Icon/Icon';
import Skeleton from '#components/ui/Skeleton/Skeleton';
import StatusLine from '#components/ui/StatusLine/StatusLine';
import { formatMovieTitle } from '#lib/format';
import { useActionStatus } from '#lib/use-action-status';

import NominationMovieCard from '../NominationMovieCard/NominationMovieCard';
import NominationMovieList from '../NominationMovieList/NominationMovieList';
import PhaseProgress from '../PhaseProgress/PhaseProgress';
import styles from './Nomination.module.scss';
import NominationSuggestions from './NominationSuggestions';

const MAX_GENRES = 3;

export default function Nomination({
    sessionId,
    data,
    header,
    isLoading = false,
}: {
    sessionId: string;
    data: TNominations;
    header: ReactNode;
    isLoading?: boolean;
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
    const picker = isLoading ? (
        <div className={styles.loadingPicker}>
            <Skeleton variant="control" shouldFill />
        </div>
    ) : (
        <NominationPicker
            chosen={chosen}
            isPending={isPending}
            onChoose={setChosen}
            onSubmit={handleSubmit}
        />
    );
    // Once the viewer has nominated, the card shows their Movie instead of the picker.
    const submittedMovie = data.canSubmit ? null : data.ownMovie;
    return (
        <section className={styles.nomination} aria-label="Movie nomination">
            <PhaseProgress>
                {data.acceptedCount
                    ? `Nomination in progress — ${data.nominatedCount} of ${data.memberCount} members have nominated.`
                    : 'Nomination in progress — no one has joined yet.'}
            </PhaseProgress>
            {header}
            <div className={styles.columns}>
                {data.canSubmit || submittedMovie ? (
                    <section
                        className={clsx(styles.card, submittedMovie && styles.submittedCard)}
                        aria-labelledby="nominate-heading"
                    >
                        <h2 id="nominate-heading" ref={headingRef} tabIndex={-1}>
                            {submittedMovie ? 'Your nomination' : 'Find & Nominate a Movie'}
                        </h2>
                        {submittedMovie ? (
                            <SubmittedMovie movie={submittedMovie} isLoading={isLoading} />
                        ) : (
                            picker
                        )}
                        <StatusLine
                            className={styles.feedback}
                            isSuccess={isSuccess}
                            message={message}
                        />
                        {submittedMovie ? null : (
                            <NominationSuggestions
                                past={data.suggestions}
                                watchlist={data.watchlist}
                                disabled={isPending || isLoading}
                                isLoading={isLoading}
                                onChoose={setChosen}
                            />
                        )}
                    </section>
                ) : null}
                <section
                    className={`${styles.card} ${styles.currentCard}`}
                    aria-labelledby="nominations-heading"
                >
                    <h2 id="nominations-heading">Current Nominations</h2>
                    <NominationList data={data} isLoading={isLoading} />
                </section>
            </div>
        </section>
    );
}

function SubmittedMovie({ movie, isLoading }: { movie: TNominationMovie; isLoading: boolean }) {
    return (
        <>
            <p className={styles.submissionStatus}>
                <Icon name="check" />
                <span>Submitted · Waiting for selection</span>
            </p>
            <NominationMovieCard
                movie={movie}
                author={null}
                maxGenres={MAX_GENRES}
                isLoading={isLoading}
            />
        </>
    );
}

function NominationList({ data, isLoading }: { data: TNominations; isLoading: boolean }) {
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
                        isLoading={isLoading}
                    />
                </li>
            ))}
        </NominationMovieList>
    );
}

function NominationPicker({
    chosen,
    isPending,
    onChoose,
    onSubmit,
}: {
    chosen: TNominationMovie | null;
    isPending: boolean;
    onChoose: (movie: TNominationMovie | null) => void;
    onSubmit: () => void;
}) {
    return (
        <MoviePicker
            disabled={isPending}
            isLabelHidden
            shouldReserveMessage={false}
            placeholder="Search films…"
            value={chosen?.id ?? null}
            selectedTitle={formatMovieTitle(chosen)}
            onChange={(movie) =>
                onChoose(
                    movie
                        ? {
                              id: movie.id,
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
                    disabled={isPending || !chosen}
                    loading={isPending}
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
