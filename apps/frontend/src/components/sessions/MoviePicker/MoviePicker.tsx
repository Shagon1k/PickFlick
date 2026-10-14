'use client';

import { MOVIE_QUERY_MAX_LENGTH } from '@pickflick/contracts';
import { useRef, useState } from 'react';

import {
    getNextOptionIndex,
    getSearchMessage,
    useActiveOptionVisible,
    useMovieSearch,
} from '#components/movies/movie-search';
import SearchCredits from '#components/movies/SearchCredits/SearchCredits';
import Button from '#components/ui/Button/Button';
import TextInput from '#components/ui/TextInput/TextInput';

import styles from './MoviePicker.module.scss';

interface IMoviePickerProps {
    value: string | null;
    onChange: (id: string | null) => void;
    error?: React.ReactNode;
    disabled: boolean;
}
export default function MoviePicker({ value, onChange, error, disabled }: IMoviePickerProps) {
    const [query, setQuery] = useState('');
    const [selectedTitle, setSelectedTitle] = useState('');
    const [index, setIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const term = query.trim();
    const result = useMovieSearch(term, !value);
    const movies = result && 'data' in result ? result.data.movies : [];
    useActiveOptionVisible('session-movie', index);
    function select(movie: (typeof movies)[number]) {
        setSelectedTitle(movie.title ?? movie.originalTitle ?? 'Untitled film');
        onChange(movie.id);
        setQuery('');
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
            <TextInput
                ref={inputRef}
                aria-activedescendant={index >= 0 ? `session-movie-${index}` : undefined}
                aria-controls="session-movies"
                aria-expanded={movies.length > 0}
                aria-autocomplete="list"
                role="combobox"
                disabled={disabled || Boolean(value)}
                error={error}
                id="session-movie"
                label="Select a Movie"
                labelHint="required"
                required
                value={value ? selectedTitle : query}
                maxLength={MOVIE_QUERY_MAX_LENGTH}
                onChange={(event) => {
                    setQuery(event.currentTarget.value);
                    setIndex(-1);
                }}
                onKeyDown={handleKeyboard}
            />
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
            <p role="status">{getSearchMessage(term, result)}</p>
            <div
                aria-label="Movie results"
                id="session-movies"
                role="listbox"
                className={styles.results}
            >
                {movies.map((movie, position) => (
                    <button
                        aria-selected={position === index}
                        id={`session-movie-${position}`}
                        key={movie.id}
                        role="option"
                        tabIndex={-1}
                        type="button"
                        onClick={() => select(movie)}
                        disabled={disabled}
                    >
                        <strong>{movie.title ?? movie.originalTitle ?? 'Untitled film'}</strong>
                        <span>{movie.releaseYear ?? 'Year unavailable'}</span>
                    </button>
                ))}
            </div>
            {result && 'data' in result ? <SearchCredits movies={result.data.movies} /> : null}
        </div>
    );
}
