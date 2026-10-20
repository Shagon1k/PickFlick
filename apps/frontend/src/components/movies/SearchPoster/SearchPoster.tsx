'use client';

import Image from 'next/image';
import { useState } from 'react';

import styles from './SearchPoster.module.scss';

const POSTER_WIDTH = 36;
const POSTER_HEIGHT = 54;

export default function SearchPoster({
    url,
    className,
}: {
    url: string | null;
    className?: string;
}) {
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    return (
        <span aria-hidden="true" className={className}>
            {url && failedUrl !== url ? (
                <Image
                    src={url}
                    alt=""
                    width={POSTER_WIDTH}
                    height={POSTER_HEIGHT}
                    loading="lazy"
                    unoptimized
                    className={styles.image}
                    onError={() => setFailedUrl(url)}
                />
            ) : (
                'PF'
            )}
        </span>
    );
}
