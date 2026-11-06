import AchievementsSkeleton from '#components/achievements/AchievementsSkeleton/AchievementsSkeleton';
import FilmTableSkeleton from '#components/movies/FilmTableSkeleton/FilmTableSkeleton';
import LoadingState from '#components/ui/LoadingState/LoadingState';

/** The skeleton that matches a tab; an unknown tab falls back to My Ratings like the page. */
export default function LibraryPanelSkeleton({ tab }: { tab?: string | string[] | null }) {
    return (
        <LoadingState label="Loading your Library…">
            {tab === 'achievements' ? (
                <AchievementsSkeleton />
            ) : (
                <FilmTableSkeleton variant={tab === 'watchlist' ? 'watchlist' : 'ratings'} />
            )}
        </LoadingState>
    );
}
