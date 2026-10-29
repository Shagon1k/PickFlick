'use client';

import { getPosterPath, type TNominationMovie, type TNominations } from '@pickflick/contracts';
import Link from 'next/link';
import { type ReactNode, useRef, useState, useTransition } from 'react';

import SearchPoster from '#components/movies/SearchPoster/SearchPoster';
import MoviePicker from '#components/sessions/MoviePicker/MoviePicker';
import Button from '#components/ui/Button/Button';
import SprocketDivider from '#components/ui/SprocketDivider/SprocketDivider';
import { getOfflineMessage } from '#lib/offline';

import { nominateAction, refreshNominationsAction } from '../../nomination-actions';
import PhaseProgress from '../PhaseProgress/PhaseProgress';
import styles from './Nomination.module.scss';

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
    const [message, setMessage] = useState('');
    const [isPending, startTransition] = useTransition();
    function run(action: 'submit' | 'refresh') {
        const offlineMessage = getOfflineMessage();
        if (offlineMessage) {
            setMessage(offlineMessage);
            return;
        }
        setMessage(action === 'refresh' ? 'Refreshing nominations…' : 'Saving…');
        startTransition(async () => {
            const request =
                action === 'submit'
                    ? nominateAction(sessionId, { movieId: chosen?.id })
                    : refreshNominationsAction(sessionId);
            const result = await request.catch(() => ({
                ok: false as const,
                message: 'We could not reach PickFlick. Try again.',
            }));
            setMessage(result.message);
            if (!result.ok) return;
            if (action === 'submit') headingRef.current?.focus();
        });
    }
    return (
        <section className={styles.nomination} aria-label="Movie nomination">
            <PhaseProgress
                refreshLabel="Refresh nominations"
                disabled={isPending}
                onRefresh={() => run('refresh')}
            >
                Nomination in progress — {data.nominatedCount} of {data.acceptedCount} participants
                have nominated.
            </PhaseProgress>
            {header}
            <div className={styles.columns}>
                <section className={styles.card} aria-labelledby="nominate-heading">
                    <h2 id="nominate-heading" ref={headingRef} tabIndex={-1}>
                        Find &amp; Nominate a Movie
                    </h2>
                    {data.canSubmit ? (
                        <NominationPicker
                            chosen={chosen}
                            disabled={isPending}
                            suggestions={data.suggestions}
                            onChoose={setChosen}
                            onSubmit={() => run('submit')}
                        />
                    ) : (
                        <SubmissionState movie={data.ownMovie} />
                    )}
                    <p
                        className={styles.feedback}
                        aria-atomic="true"
                        aria-live="polite"
                        role="status"
                    >
                        {message}
                    </p>
                </section>
                <section className={styles.card} aria-labelledby="nominations-heading">
                    <h2 id="nominations-heading">Current Nominations</h2>
                    <NominationList data={data} />
                </section>
            </div>
        </section>
    );
}

function formatMovieLabel(movie: TNominationMovie) {
    const year = movie.year ? ` (${movie.year})` : '';
    return `${movie.title ?? 'Movie title unavailable'}${year}`;
}

function SubmissionState({ movie }: { movie: TNominationMovie | null }) {
    if (!movie)
        return <p>Only Session participants can nominate. Join the Session to add your film.</p>;
    return (
        <p role="status">
            Your nomination: <Link href={`/movies/${movie.id}`}>{formatMovieLabel(movie)}</Link>.
            Your submission is locked.
        </p>
    );
}

function NominationList({ data }: { data: TNominations }) {
    if (data.hidden) return <p>Nominations are hidden until you submit your own Movie.</p>;
    if (!data.nominations.length) return <p>No nominations yet.</p>;
    return (
        <ul className={styles.movies}>
            {data.nominations.map((row, index) => (
                // eslint-disable-next-line @eslint-react/no-array-index-key -- several participants may nominate the same Movie; rows are only appended
                <li key={`${row.movie.id}-${index}`}>
                    <SearchPoster className={styles.poster} url={getPosterPath(row.movie.id)} />
                    <div className={styles.movieInfo}>
                        <Link
                            aria-label={formatMovieLabel(row.movie)}
                            href={`/movies/${row.movie.id}`}
                        >
                            {row.movie.title ?? 'Movie title unavailable'}
                        </Link>
                        {row.author !== null ? <p>by {row.author}</p> : null}
                        {row.movie.genres.length ? (
                            <ul aria-label="Genres" className={styles.genres}>
                                {row.movie.genres.slice(0, MAX_GENRES).map((genre) => (
                                    <li key={genre}>{genre}</li>
                                ))}
                            </ul>
                        ) : null}
                    </div>
                </li>
            ))}
        </ul>
    );
}

const MAX_GENRES = 3;

function NominationPicker({
    chosen,
    disabled,
    suggestions,
    onChoose,
    onSubmit,
}: {
    chosen: TNominationMovie | null;
    disabled: boolean;
    suggestions: TNominationMovie[];
    onChoose: (movie: TNominationMovie | null) => void;
    onSubmit: () => void;
}) {
    return (
        <>
            {chosen ? (
                <div className={styles.selected}>
                    <p>
                        <span className="visually-hidden">Selected: </span>
                        <strong>{chosen.title ?? 'Movie title unavailable'}</strong>
                        {chosen.year ? <span>{chosen.year}</span> : null}
                    </p>
                    <div className={styles.selectedActions}>
                        <Button
                            aria-label="Remove selected Movie"
                            disabled={disabled}
                            size="small"
                            variant="ghost"
                            onClick={() => onChoose(null)}
                        >
                            Change
                        </Button>
                        <Button loading={disabled} size="small" onClick={onSubmit}>
                            Nominate This
                        </Button>
                    </div>
                </div>
            ) : (
                <MoviePicker
                    disabled={disabled}
                    hideLabel
                    placeholder="Search films…"
                    value={null}
                    onChange={(id, movie) =>
                        onChoose(
                            id && movie
                                ? {
                                      id,
                                      title: movie.title ?? movie.originalTitle,
                                      year: movie.releaseYear,
                                      genres: [],
                                  }
                                : null,
                        )
                    }
                />
            )}
            <SprocketDivider variant="section" />
            <h3>Suggestions from your past nominations that did not win</h3>
            {suggestions.length ? (
                <ul className={styles.suggestions} aria-label="Personal nomination suggestions">
                    {suggestions.map((movie) => (
                        <li key={movie.id}>
                            <button
                                aria-label={formatMovieLabel(movie)}
                                type="button"
                                disabled={disabled}
                                onClick={() => onChoose(movie)}
                            >
                                <SearchPoster
                                    className={styles.suggestionPoster}
                                    url={getPosterPath(movie.id)}
                                />
                                <strong>{movie.title ?? 'Movie title unavailable'}</strong>
                                {movie.year ? <span>{movie.year}</span> : null}
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p>No past losing nominations in this Club yet. Search for a Movie above.</p>
            )}
        </>
    );
}
