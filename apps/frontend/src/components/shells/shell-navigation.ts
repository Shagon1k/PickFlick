import type { TIconName } from '#components/ui/Icon/Icon';

/** Product areas that mark the matching mobile tab and navigation group as current. */
export type TShellArea =
    | 'admin'
    | 'hub'
    | 'library'
    | 'movie'
    | 'recovery'
    | 'session'
    | 'settings';

export interface IShellNavigationItem {
    readonly href: string;
    readonly label: string;
    /** Shown in film strips and section navigation; items without one show a plain dot. */
    readonly icon?: TIconName;
    readonly current?: boolean;
}

interface IShellActionItem {
    readonly action: 'sign-out';
    readonly label: string;
    readonly icon: TIconName;
    readonly current?: never;
}

export type TShellMenuItem = IShellActionItem | IShellNavigationItem;

interface IMobileNavigationMenu {
    readonly icon: TIconName;
    readonly id: string;
    readonly items: readonly TShellMenuItem[];
    /** Visible trigger text; the Hub trigger shows the current Club view. */
    readonly label: string;
    /** Stable group name used for the strip's accessible name. */
    readonly name: string;
    readonly current?: boolean;
}

interface IMobileNavigationAlerts {
    readonly id: 'alerts';
    readonly label: string;
    readonly overlay: 'notifications';
}

export type TMobileNavigationEntry = IMobileNavigationAlerts | IMobileNavigationMenu;

export type THubSection =
    | 'overview'
    | 'sessions'
    | 'ratings'
    | 'members'
    | 'achievements'
    | 'manage';

export interface IShellRouteMap {
    readonly admin: string;
    readonly contact: string;
    readonly createClub: string;
    readonly features: string;
    readonly home: string;
    readonly howItWorks: string;
    readonly joinClub: string;
    readonly library: string;
    readonly legalPrivacy: string;
    readonly legalTerms: string;
    readonly pricing: string;
    readonly privacy: string;
    readonly product: string;
    readonly session: string;
    readonly settings: string;
    readonly setup: string;
}

export const canonicalRoutes: IShellRouteMap = {
    admin: '/admin',
    contact: '/contact',
    createClub: '/clubs/new',
    features: '/#features',
    home: '/',
    howItWorks: '/#how',
    joinClub: '/invite',
    library: '/library',
    legalPrivacy: '/legal/privacy',
    legalTerms: '/legal/terms',
    pricing: '/pricing',
    privacy: '/settings?tab=privacy',
    product: '/app',
    session: '/app',
    settings: '/settings',
    setup: '/login',
};

export function buildPublicNavigation(
    routes: IShellRouteMap,
    currentPage?: 'pricing',
): readonly IShellNavigationItem[] {
    return [
        { href: routes.howItWorks, label: 'How it works' },
        { href: routes.features, label: 'Features' },
        {
            href: routes.pricing,
            label: 'Pricing',
            icon: 'pricing',
            current: currentPage === 'pricing',
        },
    ];
}

export function buildProductNavigation(
    routes: IShellRouteMap,
    currentArea: TShellArea,
): readonly IShellNavigationItem[] {
    return [
        {
            href: routes.product,
            label: 'Hub',
            current: currentArea === 'hub' || currentArea === 'session',
        },
        { href: routes.library, label: 'My Library', current: currentArea === 'library' },
    ];
}

const signOutItem: IShellActionItem = { action: 'sign-out', label: 'Sign out', icon: 'sign-out' };

function buildSectionHref(route: string, tab: string): string {
    return `${route}${route.includes('?') ? '&' : '?'}tab=${tab}`;
}

export function buildAccountNavigation(
    routes: IShellRouteMap,
    isAdmin: boolean,
): readonly TShellMenuItem[] {
    return [
        ...(isAdmin ? [{ href: routes.admin, label: 'Admin Panel', icon: 'admin' } as const] : []),
        { href: routes.settings, label: 'Settings', icon: 'settings' },
        { href: routes.privacy, label: 'Privacy & data', icon: 'privacy' },
        { href: routes.pricing, label: 'Pricing', icon: 'pricing' },
        { href: routes.contact, label: 'Contact Us', icon: 'contact' },
        signOutItem,
    ];
}

const CLUB_SECTIONS: readonly {
    section: THubSection;
    path: string;
    label: string;
    icon: TIconName;
}[] = [
    { section: 'overview', path: '', label: 'Overview', icon: 'overview' },
    { section: 'sessions', path: 'sessions', label: 'Sessions', icon: 'sessions' },
    { section: 'ratings', path: 'ratings', label: 'Ratings', icon: 'ratings' },
    { section: 'members', path: 'members', label: 'Members', icon: 'members' },
    { section: 'achievements', path: 'achievements', label: 'Achievements', icon: 'achievements' },
    { section: 'manage', path: 'settings', label: 'Manage Club', icon: 'settings' },
];

/** Paths `/app?section=` may open in the viewer's last Club. */
export const CLUB_SECTION_PATHS = CLUB_SECTIONS.map(({ path }) => path);

/** Built Club views. Every member keeps Manage Club for its read-only view and Leave Club. */
export function buildClubNavigation(
    clubId: string,
    current: THubSection | null,
): readonly IShellNavigationItem[] {
    return CLUB_SECTIONS.map(({ section, path, label, icon }) => ({
        href: path ? `/clubs/${clubId}/${path}` : `/clubs/${clubId}`,
        label,
        icon,
        current: current === section,
    }));
}

/** The same sections outside a Club: `/app` opens them in the last Club the viewer visited. */
function buildLastClubNavigation(routes: IShellRouteMap): readonly IShellNavigationItem[] {
    return CLUB_SECTIONS.map(({ path, label, icon }) => ({
        href: path ? `${routes.product}?section=${path}` : routes.product,
        label,
        icon,
    }));
}

/** A Club's sections where one is in context; onboarding without a Club; otherwise the Hub itself. */
function getHubItems(
    clubItems: readonly IShellNavigationItem[],
    currentArea: TShellArea,
    isHubArea: boolean,
    routes: IShellRouteMap,
): readonly TShellMenuItem[] {
    if (clubItems.length > 0)
        return clubItems.map((item) => ({ ...item, current: isHubArea && item.current === true }));
    if (currentArea === 'hub')
        return [
            { href: routes.createClub, label: 'Create a Club', icon: 'overview' },
            { href: routes.joinClub, label: 'Join a Club', icon: 'user-plus' },
        ];
    return buildLastClubNavigation(routes);
}

export function buildMobileNavigation({
    isAdmin,
    clubItems,
    currentArea,
    libraryItems,
    routes,
    settingsItems,
}: {
    isAdmin: boolean;
    clubItems: readonly IShellNavigationItem[];
    currentArea: TShellArea;
    libraryItems?: readonly IShellNavigationItem[] | undefined;
    routes: IShellRouteMap;
    settingsItems?: readonly IShellNavigationItem[] | undefined;
}): readonly TMobileNavigationEntry[] {
    const isHubArea = currentArea === 'hub' || currentArea === 'session';
    const currentClubItem = isHubArea ? clubItems.find((item) => item.current) : undefined;
    const hubItems = getHubItems(clubItems, currentArea, isHubArea, routes);
    const defaultLibraryItems: readonly IShellNavigationItem[] = [
        {
            href: buildSectionHref(routes.library, 'my-ratings'),
            label: 'My Ratings',
            icon: 'ratings',
        },
        {
            href: buildSectionHref(routes.library, 'watchlist'),
            label: 'Watchlist',
            icon: 'watchlist',
        },
        {
            href: buildSectionHref(routes.library, 'achievements'),
            label: 'Achievements',
            icon: 'achievements',
        },
    ];
    const adminItem: IShellNavigationItem = {
        href: routes.admin,
        label: 'Admin Panel',
        icon: 'admin',
        current: currentArea === 'admin',
    };
    const defaultSettingsItems: readonly IShellNavigationItem[] = [
        { href: routes.settings, label: 'Profile', icon: 'profile' },
        {
            href: buildSectionHref(routes.settings, 'notifications'),
            label: 'Notifications',
            icon: 'bell',
        },
        {
            href: buildSectionHref(routes.settings, 'subscription'),
            label: 'Subscription',
            icon: 'credit-card',
        },
        { href: routes.privacy, label: 'Privacy & data', icon: 'privacy' },
    ];

    return [
        {
            current: isHubArea,
            icon: 'hub',
            id: 'hub',
            items: hubItems,
            label: currentClubItem?.label ?? 'Hub',
            name: 'Hub',
        },
        {
            current: currentArea === 'library',
            icon: 'library',
            id: 'library',
            items: libraryItems ?? defaultLibraryItems,
            label: 'My Library',
            name: 'My Library',
        },
        { id: 'alerts', label: 'Alerts', overlay: 'notifications' },
        {
            current: currentArea === 'settings' || currentArea === 'admin',
            icon: 'settings',
            id: 'settings',
            items: [
                ...(isAdmin ? [adminItem] : []),
                ...(settingsItems ?? defaultSettingsItems),
                signOutItem,
            ],
            label: 'Settings',
            name: 'Settings',
        },
    ];
}
