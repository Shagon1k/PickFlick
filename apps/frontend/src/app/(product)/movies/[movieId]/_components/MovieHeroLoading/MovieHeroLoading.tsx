import clsx from 'clsx';

import ticket from '#components/movies/film-ticket.module.scss';
import FilmRailSkeleton from '#components/movies/FilmRailSkeleton/FilmRailSkeleton';
import MovieMedia from '#components/movies/MovieMedia/MovieMedia';
import TicketPoster from '#components/movies/TicketPoster/TicketPoster';
import Skeleton from '#components/ui/Skeleton/Skeleton';

import page from '../../page.module.scss';
import styles from './MovieHeroLoading.module.scss';

export default function MovieHeroLoading() {
    return (
        <section className={page.hero} role="status" aria-busy="true">
            <span className="visually-hidden">Loading film details…</span>
            <div className={styles.content} aria-hidden="true" inert>
                <header className={clsx(page.titleBlock, ticket.ticket)} data-film>
                    <TicketPoster isLoading title="" url={null} />
                    <div className={clsx(page.titleCopy, ticket.copy, styles.copy)}>
                        <h1 className={styles.title}>
                            <Skeleton shouldFill />
                        </h1>
                        <div className={styles.meta}>
                            <Skeleton width="half" />
                        </div>
                    </div>
                    <div className={clsx(ticket.rail, ticket.stub)}>
                        <FilmRailSkeleton scores={1} actions={1} />
                    </div>
                </header>
                <MovieMedia title="" isLoading shouldHidePhonePoster />
            </div>
        </section>
    );
}
