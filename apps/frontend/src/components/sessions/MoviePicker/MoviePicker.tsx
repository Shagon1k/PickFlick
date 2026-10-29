'use client';

import { MOVIE_QUERY_MAX_LENGTH, type TMovieSearchResults } from '@pickflick/contracts';
import { useRef, useState } from 'react';

import {
    getNextOptionIndex,
    getSearchMessage,
    useActiveOptionVisible,
    useMovieSearch,
} from '#components/movies/movie-search';
import SearchCredits from '#components/movies/SearchCredits/SearchCredits';
import SearchPoster from '#components/movies/SearchPoster/SearchPoster';
import Button from '#components/ui/Button/Button';
import TextInput from '#components/ui/TextInput/TextInput';

import styles from './MoviePicker.module.scss';

type TSearchMovie = TMovieSearchResults['movies'][number];

interface IMoviePickerProps {
    id?: string;
    label?: string;
    required?: boolean;
    value: string | null;
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
    onChange,
    error,
    disabled,
    placeholder,
    isLabelHidden = false,
}: IMoviePickerProps) {
    const [query, setQuery] = useState('');
    const [selectedTitle, setSelectedTitle] = useState('');
    const [index, setIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const term = query.trim();
    const result = useMovieSearch(term, !value);
    const movies = result && 'data' in result ? result.data.movies : [];
    useActiveOptionVisible(id, index);
    function select(movie: TSearchMovie) {
        setSelectedTitle(movie.title ?? movie.originalTitle ?? 'Untitled film');
        onChange(movie.id, movie);
        setQuery('');
        setIndex(-1);
        inputRef.current?.focus();
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
    return (
        <div className={styles.picker}>
            <div className={styles.field}>
                <TextInput
                    ref={inputRef}
                    aria-activedescendant={movies[index] ? `${id}-${index}` : undefined}
                    aria-controls={`${id}-results`}
                    aria-expanded={movies.length > 0}
                    aria-autocomplete="list"
                    role="combobox"
                    disabled={disabled || Boolean(value)}
                    error={error}
                    id={id}
                    label={label}
                    labelHint={required ? 'required' : 'optional'}
                    labelProps={isLabelHidden ? { className: 'visually-hidden' } : undefined}
                    placeholder={placeholder}
                    required={required}
                    value={value ? selectedTitle : query}
                    maxLength={MOVIE_QUERY_MAX_LENGTH}
                    onChange={(event) => {
                        setQuery(event.currentTarget.value);
                        setIndex(-1);
                    }}
                    onKeyDown={handleKeyboard}
                />
                <div
                    aria-label="Movie results"
                    id={`${id}-results`}
                    role="listbox"
                    className={styles.results}
                >
                    {movies.map((movie, position) => (
                        <button
                            aria-selected={position === index}
                            id={`${id}-${position}`}
                            key={movie.id}
                            role="option"
                            tabIndex={-1}
                            type="button"
                            onClick={() => select(movie)}
                            disabled={disabled}
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
            </div>
            {value ? (
                <Button
                    disabled={disabled}
                    onClick={() => {
                        onChange(null);
                        requestAnimationFrame(() => inputRef.current?.focus());
                    }}
                    variant="ghost"
                >
                    Remove selected Movie
                </Button>
            ) : null}
            {/* Results speak for themselves on screen; the count stays available to assistive tech. */}
            <p className={movies.length ? 'visually-hidden' : undefined} role="status">
                {getSearchMessage(term, result)}
            </p>
            {result && 'data' in result ? <SearchCredits movies={result.data.movies} /> : null}
        </div>
    );
}
