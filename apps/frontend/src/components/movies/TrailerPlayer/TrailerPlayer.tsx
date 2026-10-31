'use client';

import type { TMovieDetails } from '@pickflick/contracts';
import { useState } from 'react';

import styles from './TrailerPlayer.module.scss';

type TTrailer = NonNullable<TMovieDetails['trailers']>[number];

const MAX_TRAILERS = 3;

/**
 * Plays a provider trailer inside the card. Nothing reaches YouTube until the viewer presses Play;
 * then the privacy-enhanced embed loads with autoplay, so one press starts the film.
 */
export default function TrailerPlayer({
    trailers,
    title,
    backdropUrl,
    posterUrl,
    searchUrl,
}: {
    trailers: TTrailer[];
    title: string;
    backdropUrl: string | null;
    posterUrl: string | null;
    searchUrl: string;
}) {
    const choices = trailers.slice(0, MAX_TRAILERS);
    const [selected, setSelected] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const trailer = choices.at(selected);
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
                    key={trailer.url}
                    referrerPolicy="strict-origin-when-cross-origin"
                    src={getEmbedUrl(trailer.url)}
                    title={`${trailer.name ?? 'Trailer'}: ${title} (YouTube)`}
                />
            ) : null}
            {trailer && !isPlaying ? (
                <button
                    aria-label={`Play ${trailer.name ?? 'Trailer'}`}
                    className={styles.facade}
                    onClick={() => setIsPlaying(true)}
                    type="button"
                >
                    <TrailerStill backdropUrl={backdropUrl} posterUrl={posterUrl} />
                    <span aria-hidden="true" className={styles.play} />
                    {trailer.name && trailer.name !== 'Trailer' ? (
                        <span className={styles.caption}>{trailer.name}</span>
                    ) : null}
                </button>
            ) : null}
            {choices.length > 1 && !isPlaying ? (
                <TrailerChoices choices={choices} selected={selected} onSelect={setSelected} />
            ) : null}
            {/* Mirrors the poster's Film details caption, so both cards of the row end alike. */}
            {isPlaying ? null : (
                <a
                    aria-label="Search YouTube for a trailer (opens in a new tab)"
                    className={styles.search}
                    href={searchUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                >
                    Search YouTube ↗
                </a>
            )}
        </section>
    );
}

function TrailerChoices({
    choices,
    selected,
    onSelect,
}: {
    choices: TTrailer[];
    selected: number;
    onSelect: (index: number) => void;
}) {
    return (
        <div className={styles.choices}>
            {choices.map((choice, index) => (
                <button
                    aria-pressed={index === selected}
                    className={styles.choice}
                    // eslint-disable-next-line @eslint-react/no-array-index-key -- provider trailers can repeat a URL and never reorder
                    key={`${choice.url}-${index}`}
                    onClick={() => onSelect(index)}
                    title={choice.name ?? undefined}
                    type="button"
                >
                    {choice.name ?? `Trailer ${index + 1}`}
                </button>
            ))}
        </div>
    );
}

/** A film still suits the wide frame; the poster stands in, blurred, when there is none. */
function TrailerStill({
    backdropUrl,
    posterUrl,
}: {
    backdropUrl: string | null;
    posterUrl: string | null;
}) {
    const still = backdropUrl ?? posterUrl;
    if (!still) return null;
    return (
        // eslint-disable-next-line @next/next/no-img-element -- a decorative same-origin still behind the Play button
        <img
            alt=""
            className={styles.backdrop}
            data-blur={backdropUrl ? undefined : true}
            src={still}
        />
    );
}

/** The contract allows only YouTube watch, embed and youtu.be links, each carrying a video ID. */
function getEmbedUrl(url: string) {
    const parsed = new URL(url);
    const id = parsed.searchParams.get('v') ?? parsed.pathname.split('/').at(-1) ?? '';
    const params = new URLSearchParams({ autoplay: '1', rel: '0' });
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${params.toString()}`;
}
