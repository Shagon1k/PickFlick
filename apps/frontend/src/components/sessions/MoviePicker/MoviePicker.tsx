'use client';

import { MOVIE_QUERY_MAX_LENGTH, type TMovieSearchResults } from '@pickflick/contracts';
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';

import {
    getNextOptionIndex,
    useActiveOptionVisible,
    useMovieSearch,
} from '#components/movies/movie-search';
import MovieSearchResults from '#components/movies/MovieSearchResults/MovieSearchResults';
import Button from '#components/ui/Button/Button';
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
    shouldReserveMessage?: boolean;
    endAction?: ReactNode;
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
    shouldReserveMessage = true,
    endAction,
}: IMoviePickerProps) {
    const [query, setQuery] = useState('');
    const [selectedMovie, setSelectedMovie] = useState<TSearchMovie | null>(null);
    const [index, setIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const removeRef = useRef<HTMLButtonElement>(null);
    const focusStateRef = useRef({ value, selectedMovie });
    useLayoutEffect(() => {
        const previous = focusStateRef.current;
        if (previous.value === value && previous.selectedMovie === selectedMovie) return;
        focusStateRef.current = { value, selectedMovie };
        const control = value ? removeRef.current : inputRef.current;
        control?.focus();
    }, [value, selectedMovie]);
    const term = query.trim();
    const result = useMovieSearch(term, !value);
    const movies = result && 'data' in result ? result.data.movies : [];
    useActiveOptionVisible(id, index);
    function select(movie: TSearchMovie) {
        setSelectedMovie(movie);
        onChange(movie.id, movie);
        setQuery('');
        setIndex(-1);
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
    const rightSection =
        value || endAction ? (
            <span className={styles.actions}>
                <span className={styles.change} data-hidden={!value || undefined}>
                    <Button
                        aria-label="Change film"
                        title="Change film"
                        ref={removeRef}
                        disabled={disabled || !value}
                        size="icon"
                        variant="subtle"
                        onClick={() => {
                            onChange(null);
                            setSelectedMovie(null);
                        }}
                    >
                        <span className={styles.actionIcon} data-press-surface>
                            <Icon name="close" />
                        </span>
                    </Button>
                </span>
                {endAction}
            </span>
        ) : undefined;
    const actionWidth = endAction ? 'calc(var(--hit) * 2)' : undefined;
    if (value) {
        const selected = selectedMovie?.id === value ? selectedMovie : null;
        const title =
            selected?.title ?? selected?.originalTitle ?? selectedTitle ?? 'Untitled film';
        return (
            <div className={styles.picker}>
                <TextInput
                    ref={inputRef}
                    id={id}
                    label={label}
                    labelHint={required ? 'required' : 'optional'}
                    labelProps={isLabelHidden ? { className: 'visually-hidden' } : undefined}
                    value={title}
                    title={title}
                    readOnly
                    disabled={disabled}
                    error={error}
                    shouldReserveMessage={shouldReserveMessage}
                    variant="selected"
                    rightSectionPointerEvents="auto"
                    rightSectionWidth={actionWidth}
                    rightSection={rightSection}
                />
            </div>
        );
    }
    return (
        <div className={styles.picker}>
            <TextInput
                ref={inputRef}
                aria-activedescendant={movies[index] ? `${id}-${index}` : undefined}
                aria-controls={`${id}-results`}
                aria-expanded={Boolean(term)}
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
                shouldReserveMessage={shouldReserveMessage}
                rightSectionPointerEvents="auto"
                rightSectionWidth={actionWidth}
                rightSection={rightSection}
                value={query}
                maxLength={MOVIE_QUERY_MAX_LENGTH}
                onChange={(event) => {
                    setQuery(event.currentTarget.value);
                    setIndex(-1);
                }}
                onKeyDown={handleKeyboard}
                dropdown={
                    <MovieSearchResults
                        idPrefix={id}
                        term={term}
                        result={result}
                        activeIndex={index}
                        disabled={disabled}
                        onSelect={select}
                    />
                }
            />
        </div>
    );
}
