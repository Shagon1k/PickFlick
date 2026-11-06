import type { IShellNavigationItem } from '#components/shells/shell-navigation';

type TLibraryTab = 'my-ratings' | 'watchlist' | 'achievements';

const LIBRARY_TABS: { tab: TLibraryTab; label: string; icon: IShellNavigationItem['icon'] }[] = [
    { tab: 'my-ratings', label: 'My Ratings', icon: 'ratings' },
    { tab: 'watchlist', label: 'Watchlist', icon: 'watchlist' },
    { tab: 'achievements', label: 'Achievements', icon: 'achievements' },
];

/** The Library section tabs; `current` is left out while the page is still loading. */
export function getLibraryTabItems(current?: TLibraryTab): IShellNavigationItem[] {
    return LIBRARY_TABS.map(({ tab, label, icon }) => ({
        label,
        icon,
        href: `/library?tab=${tab}`,
        current: current ? current === tab : undefined,
    }));
}
