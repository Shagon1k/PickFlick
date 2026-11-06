'use client';

import clsx from 'clsx';
import Image from 'next/image';
import { type ReactNode, useState } from 'react';

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
    let content: ReactNode = <span>Poster unavailable</span>;
    if (isLoading) content = <Skeleton shouldFill />;
    else if (url && url !== failedUrl)
        content = (
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
        );
    return <div className={clsx(styles.poster, className)}>{content}</div>;
}
