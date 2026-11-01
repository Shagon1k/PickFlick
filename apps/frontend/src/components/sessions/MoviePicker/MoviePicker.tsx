'use client';

import {
    getPosterPath,
    MOVIE_QUERY_MAX_LENGTH,
    type TMovieSearchResults,
} from '@pickflick/contracts';
import { useRef, useState } from 'react';

import {
    getNextOptionIndex,
    getSearchMessage,
    useActiveOptionVisible,
    useMovieSearch,
} from '#components/movies/movie-search';
import SearchCredits from '#components/movies/SearchCredits/SearchCredits';
import SearchPoster from '#components/movies/SearchPoster/SearchPoster';
import Icon from '#components/ui/Icon/Icon';
import TextInput from '#components/ui/TextInput/TextInput';

import styles from './MoviePicker.module.scss';

type TSearchMovie = TMovieSearchResults['movies'][number];

interface IMoviePickerProps {
    id?: string;
    label?: string;
    required?: boolean;
    value: string | null;
    selectedTitle?: string;
    onChange: (id: string | null, movie?: TSearchMovie) => void;
    error?: React.ReactNode;
    disabled: boolean;
    placeholder: string;
    /** The Nomination card names the task in its heading, so the field label is for assistive tech. */
    isLabelHidden?: boolean;
}
export default function MoviePicker({
    id = 'session-movie',
    label = 'Select a Movie',
    required = true,
    value,
    selectedTitle,
    onChange,
    error,
    disabled,
    placeholder,
    isLabelHidden = false,
}: IMoviePickerProps) {
    const [query, setQuery] = useState('');
    const [selectedMovie, setSelectedMovie] = useState<TSearchMovie | null>(null);
    const [index, setIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const removeRef = useRef<HTMLButtonElement>(null);
    const term = query.trim();
    const result = useMovieSearch(term, !value);
    const movies = result && 'data' in result ? result.data.movies : [];
    useActiveOptionVisible(id, index);
    function select(movie: TSearchMovie) {
        setSelectedMovie(movie);
        onChange(movie.id, movie);
        setQuery('');
        setIndex(-1);
        requestAnimationFrame(() => {
            const control = removeRef.current ?? inputRef.current;
            control?.focus();
        });
    }
    function handleKeyboard(event: React.KeyboardEvent<HTMLInputElement>) {
        if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && movies.length) {
            event.preventDefault();
            setIndex((current) => getNextOptionIndex(event.key, current, movies.length));
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            const movie = movies[index];
            if (movie) select(movie);
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            setQuery('');
            setIndex(-1);
        }
    }
    if (value) {
        return (
            <div className={styles.selected} role="group" aria-label="Selected film">
                <SearchPoster className={styles.selectedPoster} url={getPosterPath(value)} />
                <div className={styles.info}>
                    <strong>
                        {selectedMovie?.title ??
                            selectedMovie?.originalTitle ??
                            selectedTitle ??
                            'Untitled film'}
                    </strong>
                    {selectedMovie?.releaseYear ? <span>{selectedMovie.releaseYear}</span> : null}
                </div>
                <button
                    className={styles.remove}
                    aria-label="Change film"
                    ref={removeRef}
                    disabled={disabled}
                    onClick={() => {
                        onChange(null);
                        setSelectedMovie(null);
                        requestAnimationFrame(() => inputRef.current?.focus());
                    }}
                    type="button"
                >
                    <Icon name="close" />
                </button>
            </div>
        );
    }
    return (
        <div className={styles.picker}>
            <TextInput
                ref={inputRef}
                aria-activedescendant={movies[index] ? `${id}-${index}` : undefined}
                aria-controls={`${id}-results`}
                aria-expanded={movies.length > 0}
                aria-autocomplete="list"
                role="combobox"
                disabled={disabled}
                error={error}
                id={id}
                label={label}
                labelHint={required ? 'required' : 'optional'}
                labelProps={isLabelHidden ? { className: 'visually-hidden' } : undefined}
                placeholder={placeholder}
                required={required}
                value={query}
                maxLength={MOVIE_QUERY_MAX_LENGTH}
                onChange={(event) => {
                    setQuery(event.currentTarget.value);
                    setIndex(-1);
                }}
                onKeyDown={handleKeyboard}
                dropdown={
                    <>
                        <div
                            aria-label="Movie results"
                            id={`${id}-results`}
                            role="listbox"
                            className={styles.results}
                        >
                            {movies.map((movie, position) => (
                                <button
                                    aria-selected={position === index}
                                    disabled={disabled}
                                    id={`${id}-${position}`}
                                    key={movie.id}
                                    onClick={() => select(movie)}
                                    role="option"
                                    tabIndex={-1}
                                    type="button"
                                >
                                    <SearchPoster className={styles.poster} url={movie.posterUrl} />
                                    <span className={styles.info}>
                                        <strong>
                                            {movie.title ?? movie.originalTitle ?? 'Untitled film'}
                                        </strong>
                                        <span>{movie.releaseYear ?? 'Year unavailable'}</span>
                                    </span>
                                </button>
                            ))}
                        </div>
                        <p
                            className={movies.length ? 'visually-hidden' : styles.searchStatus}
                            role="status"
                        >
                            {getSearchMessage(term, result)}
                        </p>
                    </>
                }
            />
            {result && 'data' in result ? <SearchCredits movies={result.data.movies} /> : null}
        </div>
    );
}
