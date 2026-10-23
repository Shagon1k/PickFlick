import Link from 'next/link';
import type { ReactNode } from 'react';

import ticket from '#components/movies/film-ticket.module.scss';
import MoviePoster from '#components/movies/MoviePoster/MoviePoster';

/**
 * The poster of a film ticket (see film-ticket.module.scss). With `href` it links to Movie Details
 * and shows the info mark; the visible title link stays the named way in.
 */
export default function TicketPoster({
    url,
    title,
    href,
    corner,
}: {
    url: string | null;
    title: string;
    href?: string;
    /** A control over the poster's top-right corner, such as the Watchlist ribbon. */
    corner?: ReactNode;
}) {
    const poster = <MoviePoster url={url} title={title} />;
    if (!href)
        return (
            <div className={ticket.poster}>
                {poster}
                {corner}
            </div>
        );
    return (
        <Link aria-hidden="true" className={ticket.poster} href={href} tabIndex={-1}>
            {poster}
            <span className={ticket.infoMark}>i</span>
        </Link>
    );
}
