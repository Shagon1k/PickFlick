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
    readonly current?: boolean;
}

interface IShellActionItem {
    readonly action: 'sign-out';
    readonly label: string;
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
        { href: routes.pricing, label: 'Pricing', current: currentPage === 'pricing' },
    ];
}

export function buildProductNavigation(routes: IShellRouteMap): readonly IShellNavigationItem[] {
    return [
        { href: routes.product, label: 'Hub' },
        { href: routes.library, label: 'My Library' },
    ];
}

const signOutItem: IShellActionItem = { action: 'sign-out', label: 'Sign out' };

function buildSectionHref(route: string, tab: string): string {
    return `${route}${route.includes('?') ? '&' : '?'}tab=${tab}`;
}

export function buildAccountNavigation(
    routes: IShellRouteMap,
    isAdmin: boolean,
): readonly TShellMenuItem[] {
    return [
        ...(isAdmin ? [{ href: routes.admin, label: 'Admin Panel' }] : []),
        { href: routes.settings, label: 'Settings' },
        { href: routes.privacy, label: 'Privacy & data' },
        { href: routes.pricing, label: 'Pricing' },
        { href: routes.contact, label: 'Contact Us' },
        signOutItem,
    ];
}

/** Built Club views. Every member keeps Manage Club for its read-only view and Leave Club. */
export function buildClubNavigation(
    clubId: string,
    current: 'overview' | 'sessions' | 'members' | 'manage' | null,
): readonly IShellNavigationItem[] {
    const hub = `/clubs/${clubId}`;
    return [
        { href: hub, label: 'Overview', current: current === 'overview' },
        { href: `${hub}/sessions`, label: 'Sessions', current: current === 'sessions' },
        { href: `${hub}/members`, label: 'Members', current: current === 'members' },
        { href: `${hub}/settings`, label: 'Manage Club', current: current === 'manage' },
    ];
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
            { href: routes.createClub, label: 'Create a Club' },
            { href: routes.joinClub, label: 'Join a Club' },
        ];
    return [{ href: routes.product, label: 'Club Hub' }];
}

export function buildMobileNavigation({
    admin,
    clubItems,
    currentArea,
    libraryItems,
    routes,
    settingsItems,
}: {
    admin: boolean;
    clubItems: readonly IShellNavigationItem[];
    currentArea: TShellArea;
    libraryItems?: readonly IShellNavigationItem[] | undefined;
    routes: IShellRouteMap;
    settingsItems?: readonly IShellNavigationItem[] | undefined;
}): readonly TMobileNavigationEntry[] {
    const isHubArea = currentArea === 'hub' || currentArea === 'session';
    const currentClubItem = isHubArea ? clubItems.find((item) => item.current) : undefined;
    const hubItems = getHubItems(clubItems, currentArea, isHubArea, routes);

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
            items: libraryItems ?? [
                { href: buildSectionHref(routes.library, 'my-ratings'), label: 'My Ratings' },
                { href: buildSectionHref(routes.library, 'watchlist'), label: 'Watchlist' },
                { href: buildSectionHref(routes.library, 'achievements'), label: 'Achievements' },
            ],
            label: 'My Library',
            name: 'My Library',
        },
        { id: 'alerts', label: 'Alerts', overlay: 'notifications' },
        {
            current: currentArea === 'settings' || currentArea === 'admin',
            icon: 'settings',
            id: 'settings',
            items: [
                ...(admin
                    ? [
                          {
                              href: routes.admin,
                              label: 'Admin Panel',
                              current: currentArea === 'admin',
                          },
                      ]
                    : []),
                ...(settingsItems ?? [
                    { href: routes.settings, label: 'Profile' },
                    {
                        href: buildSectionHref(routes.settings, 'notifications'),
                        label: 'Notifications',
                    },
                    {
                        href: buildSectionHref(routes.settings, 'subscription'),
                        label: 'Subscription',
                    },
                    { href: routes.privacy, label: 'Privacy & data' },
                ]),
                signOutItem,
            ],
            label: 'Settings',
            name: 'Settings',
        },
    ];
}
