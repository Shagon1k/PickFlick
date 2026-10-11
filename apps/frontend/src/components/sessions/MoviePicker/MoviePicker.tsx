'use client';

import { useEffect, useRef, useState } from 'react';

import { searchMoviesAction } from '@/components/shells/ProductSearch/actions';
import SearchCredits from '@/components/shells/ProductSearch/SearchCredits';
import Button from '@/components/ui/Button/Button';
import TextInput from '@/components/ui/TextInput/TextInput';

import styles from './MoviePicker.module.scss';

type TResult = Awaited<ReturnType<typeof searchMoviesAction>>;
interface IMoviePickerProps {
    value: string | null;
    onChange: (id: string | null) => void;
    error?: React.ReactNode;
    disabled: boolean;
}
export default function MoviePicker({ value, onChange, error, disabled }: IMoviePickerProps) {
    const [query, setQuery] = useState('');
    const [response, setResponse] = useState<{ query: string; result: TResult } | null>(null);
    const [selectedTitle, setSelectedTitle] = useState('');
    const [index, setIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const term = query.trim();
    const result = response?.query === term ? response.result : null;
    const movies = result && 'data' in result ? result.data.movies : [];
    useEffect(() => {
        if (!term || value) return;
        let cancelled = false;
        const timer = setTimeout(() => {
            void searchMoviesAction(term).then(
                (result) => {
                    if (!cancelled) setResponse({ query: term, result });
                },
                () => {
                    if (!cancelled) setResponse({ query: term, result: { state: 'error' } });
                },
            );
        }, 300);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [term, value]);
    useEffect(() => {
        if (index >= 0)
            document.getElementById(`session-movie-${index}`)?.scrollIntoView({ block: 'nearest' });
    }, [index]);
    function select(movie: (typeof movies)[number]) {
        setSelectedTitle(movie.title ?? movie.originalTitle ?? 'Untitled film');
        onChange(movie.id);
        setQuery('');
        setResponse(null);
        inputRef.current?.focus();
    }
    function handleKeyboard(event: React.KeyboardEvent<HTMLInputElement>) {
        if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && movies.length) {
            event.preventDefault();
            setIndex((current) => {
                if (event.key === 'ArrowDown') return (current + 1) % movies.length;
                return current < 0
                    ? movies.length - 1
                    : (current - 1 + movies.length) % movies.length;
            });
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
                maxLength={200}
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
            <p role="status">{searchMessage(term, result)}</p>
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

function searchMessage(term: string, result: TResult | null): string {
    if (!term) return '';
    if (!result) return 'Searching films…';
    if (result.state === 'signed-out') return 'Sign in again to search films.';
    if (result.state === 'unavailable' || result.state === 'error')
        return 'Film search is unavailable. Try again shortly.';
    if (result.state === 'invalid') return 'Use 1–200 characters.';
    if (!result.data.movies.length) return 'No films found. Try another title.';
    if (result.state === 'stale') return 'Showing cached results.';
    return `${result.data.movies.length} films found.`;
}
