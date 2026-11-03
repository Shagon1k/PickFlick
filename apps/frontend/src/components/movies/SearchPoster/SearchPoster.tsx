'use client';

import Image from 'next/image';
import { useState } from 'react';

import ColorReveal from '#components/ui/ColorReveal/ColorReveal';
import Skeleton from '#components/ui/Skeleton/Skeleton';

import styles from './SearchPoster.module.scss';

const POSTER_WIDTH = 36;
const POSTER_HEIGHT = 54;

export default function SearchPoster({
    url,
    className,
    withColorReveal = false,
    isLoading = false,
}: {
    url: string | null;
    className?: string;
    withColorReveal?: boolean;
    isLoading?: boolean;
}) {
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    const image =
        url && failedUrl !== url ? (
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
        ) : null;
    return (
        <span aria-hidden="true" className={className}>
            {isLoading ? (
                <Skeleton shouldFill />
            ) : image ? (
                withColorReveal ? (
                    <ColorReveal shouldFill>{image}</ColorReveal>
                ) : (
                    image
                )
            ) : (
                'PF'
            )}
        </span>
    );
}
