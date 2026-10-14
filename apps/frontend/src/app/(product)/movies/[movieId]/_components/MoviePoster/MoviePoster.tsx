'use client';

import Image from 'next/image';
import { useState } from 'react';

import styles from '../../page.module.scss';

const POSTER_WIDTH = 300;
const POSTER_HEIGHT = 450;

interface IMoviePosterProps {
    url: string | null;
    title: string;
}

export default function MoviePoster({ url, title }: IMoviePosterProps) {
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    return (
        <div className={styles.poster}>
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
