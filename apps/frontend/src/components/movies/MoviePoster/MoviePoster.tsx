'use client';

import clsx from 'clsx';
import Image from 'next/image';
import { useState } from 'react';

import styles from './MoviePoster.module.scss';

const POSTER_WIDTH = 300;
const POSTER_HEIGHT = 450;

interface IMoviePosterProps {
    url: string | null;
    title: string;
    className?: string;
}

export default function MoviePoster({ url, title, className }: IMoviePosterProps) {
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    return (
        <div className={clsx(styles.poster, className)}>
            {url && url !== failedUrl ? (
                <Image
                    src={url}
                    alt={`${title} poster`}
                    width={POSTER_WIDTH}
                    height={POSTER_HEIGHT}
                    unoptimized
                    onError={() => setFailedUrl(url)}
                />
            ) : (
                <span>Poster unavailable</span>
            )}
        </div>
    );
}
