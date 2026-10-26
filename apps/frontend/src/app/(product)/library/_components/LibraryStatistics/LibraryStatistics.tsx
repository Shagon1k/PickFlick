import type { TLibraryStatistics } from '@pickflick/contracts';

import BrandImage from '#components/ui/BrandImage/BrandImage';
import Icon, { type TIconName } from '#components/ui/Icon/Icon';

import styles from './LibraryStatistics.module.scss';

export default function LibraryStatistics({ statistics }: { statistics: TLibraryStatistics }) {
    const tiles: {
        label: string;
        value: string | number | null;
        icon: TIconName;
        isText?: boolean;
    }[] = [
        { label: 'Films rated', value: statistics.filmsRated, icon: 'film-reel' },
        { label: 'Rated this year', value: statistics.ratedThisYear, icon: 'clapperboard' },
        { label: 'Avg rating', value: formatNumber(statistics.averageRating), icon: 'star-circle' },
        {
            label: 'Total watch time, h',
            value: formatNumber(statistics.totalWatchHours),
            icon: 'stopwatch',
        },
        { label: 'On watchlist', value: statistics.watchlistCount, icon: 'watchlist' },
        { label: 'Favorite genre', value: statistics.favoriteGenre, icon: 'genre', isText: true },
        { label: 'Top director', value: statistics.topDirector, icon: 'director', isText: true },
        { label: 'Top actor', value: statistics.topActor, icon: 'actor', isText: true },
    ];
    return (
        <section aria-label="Personal statistics" className={styles.statistics}>
            <div className={styles.stage}>
                <BrandImage asset="searchDiscovery" alt="" className={styles.mascot} />
                <div className={styles.tiles} role="list">
                    {tiles.map((tile) => (
                        <div className={styles.tile} key={tile.label} role="listitem">
                            <Icon name={tile.icon} />
                            <dl className={styles.copy}>
                                <dt>{tile.label}</dt>
                                <dd data-text={tile.isText || undefined}>{tile.value ?? '—'}</dd>
                            </dl>
                        </div>
                    ))}
                </div>
            </div>
            <p className={styles.explanation}>
                {statistics.filmsRated === 0 && 'Rate a film to start your personal statistics. '}
                Each rated film counts once. This year uses the latest rating update in UTC. Watch
                time estimates one viewing per rated film. Metadata summaries need details for every
                rated film and may change with catalog updates. An em dash means unavailable.
            </p>
        </section>
    );
}

function formatNumber(value: number | null) {
    return value === null
        ? null
        : new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(value);
}
