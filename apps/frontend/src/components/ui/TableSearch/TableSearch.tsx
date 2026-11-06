'use client';

import { useEffect, useId, useRef, useState } from 'react';

import TextInput from '#components/ui/TextInput/TextInput';

import styles from './TableSearch.module.scss';

const SEARCH_DELAY_MS = 400;

export default function TableSearch({
    value,
    label,
    maxLength,
    onSearch,
}: {
    value: string;
    label: string;
    maxLength: number;
    onSearch: (value: string) => void;
}) {
    const id = useId();
    const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const onSearchRef = useRef(onSearch);
    const [search, setSearch] = useState({ initialValue: value, value });
    if (search.initialValue !== value) {
        // Keep newer typing when an earlier search response arrives.
        setSearch({
            initialValue: value,
            value: search.value === search.initialValue ? value : search.value,
        });
    }
    useEffect(() => {
        onSearchRef.current = onSearch;
    }, [onSearch]);
    useEffect(() => () => clearTimeout(timerRef.current), []);
    function submit(value: string) {
        clearTimeout(timerRef.current);
        onSearchRef.current(value);
    }
    return (
        <form
            className={styles.tableSearch}
            role="search"
            aria-label={label}
            onSubmit={(event) => {
                event.preventDefault();
                submit(search.value);
            }}
        >
            <TextInput
                id={id}
                type="search"
                label={label}
                isLabelHidden
                shouldReserveMessage={false}
                placeholder={label}
                maxLength={maxLength}
                value={search.value}
                onChange={(event) => {
                    const value = event.currentTarget.value;
                    setSearch((current) => ({ ...current, value }));
                    clearTimeout(timerRef.current);
                    timerRef.current = setTimeout(() => submit(value), SEARCH_DELAY_MS);
                }}
            />
        </form>
    );
}
