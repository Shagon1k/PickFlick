'use client';

import { Box } from '@mantine/core';
import clsx from 'clsx';

import styles from './Skeleton.module.scss';

export default function Skeleton({
    variant = 'text',
    width = 'full',
    tone = 'default',
    shouldFill = false,
    text,
}: {
    variant?: 'text' | 'title' | 'avatar' | 'control';
    width?: 'full' | 'half' | 'short';
    tone?: 'default' | 'search';
    shouldFill?: boolean;
    text?: string | number;
}) {
    if (text !== undefined)
        return (
            <Box component="span" aria-hidden="true" className={styles.measured}>
                <span className={styles.measured__content}>{text}</span>
                <span className={styles.measured__paint}>
                    <Skeleton tone={tone} shouldFill />
                </span>
            </Box>
        );
    return (
        <Box
            component="span"
            aria-hidden="true"
            className={clsx(
                styles.skeleton,
                variant !== 'text' && styles[`m-${variant}`],
                width !== 'full' && styles[`m-${width}`],
                tone === 'search' && styles['m-search'],
                shouldFill && styles['m-fill'],
            )}
        />
    );
}
