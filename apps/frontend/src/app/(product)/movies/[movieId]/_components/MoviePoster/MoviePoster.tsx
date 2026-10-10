'use client';

import Image from 'next/image';
import { useState } from 'react';

import styles from '../../page.module.scss';

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
                    width={300}
                    height={450}
                    unoptimized
                    onError={() => setFailedUrl(url)}
                />
            ) : (
                <span>Poster unavailable</span>
            )}
        </div>
    );
}
