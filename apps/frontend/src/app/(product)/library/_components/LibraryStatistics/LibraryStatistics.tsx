import type { TLibraryStatistics } from '@pickflick/contracts';

import BrandImage from '#components/ui/BrandImage/BrandImage';
import Icon, { type TIconName } from '#components/ui/Icon/Icon';
import InfoTip from '#components/ui/InfoTip/InfoTip';
import { formatAverage, formatHours } from '#lib/format';

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
        {
            label: 'Avg rating',
            value:
                statistics.averageRating === null ? null : formatAverage(statistics.averageRating),
            icon: 'star-circle',
        },
        {
            label: 'Total watch time, h',
            value:
                statistics.totalWatchHours === null
                    ? null
                    : formatHours(statistics.totalWatchHours),
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
            <div className={styles.about}>
                {statistics.filmsRated === 0 ? <p>Rate a film to start your statistics.</p> : null}
                <InfoTip label="How these are counted">
                    Each rated film counts once, and this year counts films you last rated this
                    year. Watch time assumes one viewing per film. Genre, director and actor need
                    details for every rated film; a dash means they are not available yet.
                </InfoTip>
            </div>
        </section>
    );
}
