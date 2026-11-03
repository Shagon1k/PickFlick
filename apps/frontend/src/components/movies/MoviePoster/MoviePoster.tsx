'use client';

import clsx from 'clsx';
import Image from 'next/image';
import { useState } from 'react';

import ColorReveal from '#components/ui/ColorReveal/ColorReveal';
import Skeleton from '#components/ui/Skeleton/Skeleton';

import styles from './MoviePoster.module.scss';

const POSTER_WIDTH = 300;
const POSTER_HEIGHT = 450;

interface IMoviePosterProps {
    url: string | null;
    title: string;
    className?: string;
    isLoading?: boolean;
}

export default function MoviePoster({
    url,
    title,
    className,
    isLoading = false,
}: IMoviePosterProps) {
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    return (
        <div className={clsx(styles.poster, className)}>
            {isLoading ? (
                <Skeleton shouldFill />
            ) : url && url !== failedUrl ? (
                <ColorReveal shouldFill>
                    <Image
                        src={url}
                        alt={`${title} poster`}
                        width={POSTER_WIDTH}
                        height={POSTER_HEIGHT}
                        unoptimized
                        onError={() => setFailedUrl(url)}
                    />
                </ColorReveal>
            ) : (
                <span>Poster unavailable</span>
            )}
        </div>
    );
}
