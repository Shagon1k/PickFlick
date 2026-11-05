'use client';

import {
    getTrailerThumbnailPath,
    getYouTubeVideoId,
    type TMovieDetails,
} from '@pickflick/contracts';
import { useCallback, useState } from 'react';

import Button from '#components/ui/Button/Button';
import ColorReveal from '#components/ui/ColorReveal/ColorReveal';
import Icon from '#components/ui/Icon/Icon';

import styles from './TrailerPlayer.module.scss';

type TTrailer = NonNullable<TMovieDetails['trailers']>[number] & { videoId: string };

const MAX_TRAILERS = 3;

/** The browser loads only our cached preview until Play opens the privacy-enhanced player. */
export default function TrailerPlayer({
    movieId,
    trailers,
    title,
    searchUrl,
}: {
    movieId: string;
    trailers: NonNullable<TMovieDetails['trailers']>;
    title: string;
    searchUrl: string;
}) {
    const choices = getChoices(trailers);
    const [selectedId, setSelectedId] = useState<string>();
    const [playingId, setPlayingId] = useState<string>();
    const trailer = choices.find(({ videoId }) => videoId === selectedId) ?? choices[0];
    const selected = choices.findIndex(({ videoId }) => videoId === trailer?.videoId);
    const isPlaying = Boolean(trailer && playingId === trailer.videoId);
    const label = trailer ? getTrailerLabel(trailer.name, selected) : 'Trailer';
    function select(offset: number) {
        const next = choices[(selected + offset + choices.length) % choices.length];
        if (next) setSelectedId(next.videoId);
        setPlayingId(undefined);
    }
    return (
        <section className={styles.player} aria-labelledby="trailer-title">
            <h2 className="visually-hidden" id="trailer-title">
                Trailer
            </h2>
            {trailer ? null : (
                <p className={styles.empty}>Our film sources have no trailer for this film.</p>
            )}
            {trailer && isPlaying ? (
                <iframe
                    allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                    allowFullScreen
                    className={styles.frame}
                    key={trailer.videoId}
                    referrerPolicy="strict-origin-when-cross-origin"
                    src={getEmbedUrl(trailer.videoId)}
                    title={`${label}: ${title} (YouTube)`}
                />
            ) : null}
            {trailer && !isPlaying ? (
                <button
                    aria-label={`Play ${label}: ${title}`}
                    className={styles.facade}
                    data-color-reveal-trigger
                    onClick={() => setPlayingId(trailer.videoId)}
                    type="button"
                >
                    <span aria-hidden="true" className={styles.preview}>
                        <ColorReveal key={trailer.videoId} shouldFill>
                            <TrailerStill src={getTrailerThumbnailPath(movieId, trailer.videoId)} />
                        </ColorReveal>
                    </span>
                    <span aria-hidden="true" className={styles.play} data-press-surface />
                    {isMeaningfulName(trailer.name) ? (
                        <span className={styles.caption}>{trailer.name}</span>
                    ) : null}
                </button>
            ) : null}
            {isPlaying ? null : (
                <div className={styles.footer} data-single={choices.length <= 1 || undefined}>
                    {choices.length > 1 ? (
                        <div className={styles.choices} role="group" aria-label="Choose a trailer">
                            <Button
                                aria-label="Previous trailer"
                                variant="navigation"
                                onClick={() => select(-1)}
                            >
                                <Icon name="arrow-left" />
                            </Button>
                            <span className={styles.count} aria-live="polite" aria-atomic="true">
                                <span className="visually-hidden">Trailer </span>
                                {selected + 1} / {choices.length}
                            </span>
                            <Button
                                aria-label="Next trailer"
                                variant="navigation"
                                data-direction="next"
                                onClick={() => select(1)}
                            >
                                <Icon name="arrow-left" />
                            </Button>
                        </div>
                    ) : null}
                    <a
                        aria-label="Search YouTube for a trailer (opens in a new tab)"
                        className={styles.search}
                        href={searchUrl}
                        rel="noopener noreferrer"
                        target="_blank"
                    >
                        Search YouTube ↗
                    </a>
                </div>
            )}
        </section>
    );
}

function getChoices(trailers: NonNullable<TMovieDetails['trailers']>): TTrailer[] {
    const ids = new Set<string>();
    const choices: TTrailer[] = [];
    for (const trailer of trailers) {
        const videoId = getYouTubeVideoId(trailer.url);
        if (ids.has(videoId)) continue;
        ids.add(videoId);
        choices.push({ ...trailer, videoId });
        if (choices.length === MAX_TRAILERS) break;
    }
    return choices;
}

function isMeaningfulName(name: string | null): name is string {
    return Boolean(name?.trim() && name.trim().toLowerCase() !== 'trailer');
}

function getTrailerLabel(name: string | null, index: number) {
    return isMeaningfulName(name) ? name : `Trailer ${index + 1}`;
}

/** A failed video preview leaves a neutral cover; the Play action is still available. */
function TrailerStill({ src }: { src: string }) {
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasFailed, setHasFailed] = useState(false);
    const revealCachedImage = useCallback((image: HTMLImageElement | null) => {
        // A cached preview can finish loading before React attaches its load handler.
        if (image?.complete && image.naturalWidth > 0) setIsLoaded(true);
    }, []);
    if (hasFailed) return null;
    return (
        // eslint-disable-next-line @next/next/no-img-element -- authenticated same-origin image, bypassing the optimizer
        <img
            alt=""
            className={styles.backdrop}
            data-loaded={isLoaded || undefined}
            decoding="async"
            loading="lazy"
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasFailed(true)}
            ref={revealCachedImage}
            src={src}
        />
    );
}

function getEmbedUrl(videoId: string) {
    const params = new URLSearchParams({ autoplay: '1', rel: '0' });
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${params}`;
}
