import type { IconName } from '@pickflick/ui';

/** Product areas that mark the matching mobile tab and navigation group as current. */
export type ShellArea = 'admin' | 'hub' | 'library' | 'recovery' | 'session' | 'settings';

export interface ShellNavigationItem {
    readonly href: string;
    readonly label: string;
    readonly current?: boolean;
}

export interface ShellActionItem {
    readonly action: 'sign-out';
    readonly label: string;
    readonly current?: never;
}

export type ShellMenuItem = ShellActionItem | ShellNavigationItem;

export interface MobileNavigationMenu {
    readonly icon: IconName;
    readonly id: string;
    readonly items: readonly ShellMenuItem[];
    /** Visible trigger text; the Hub trigger shows the current Club view. */
    readonly label: string;
    /** Stable group name used for the strip's accessible name. */
    readonly name: string;
    readonly current?: boolean;
}

export interface MobileNavigationAlerts {
    readonly id: 'alerts';
    readonly label: string;
    readonly overlay: 'notifications';
}

export type MobileNavigationEntry = MobileNavigationAlerts | MobileNavigationMenu;

export interface ShellRouteMap {
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

export const canonicalRoutes: ShellRouteMap = {
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

export function publicNavigation(
    routes: ShellRouteMap,
    currentPage?: 'pricing',
): readonly ShellNavigationItem[] {
    return [
        { href: routes.howItWorks, label: 'How it works' },
        { href: routes.features, label: 'Features' },
        { href: routes.pricing, label: 'Pricing', current: currentPage === 'pricing' },
    ];
}

export function productNavigation(routes: ShellRouteMap): readonly ShellNavigationItem[] {
    return [
        { href: routes.product, label: 'Hub' },
        { href: routes.library, label: 'My Library' },
    ];
}

const signOutItem: ShellActionItem = { action: 'sign-out', label: 'Sign out' };

function sectionHref(route: string, tab: string): string {
    return `${route}${route.includes('?') ? '&' : '?'}tab=${tab}`;
}

export function accountNavigation(routes: ShellRouteMap, admin: boolean): readonly ShellMenuItem[] {
    return [
        ...(admin ? [{ href: routes.admin, label: 'Admin Panel' }] : []),
        { href: routes.settings, label: 'Settings' },
        { href: routes.privacy, label: 'Privacy & data' },
        signOutItem,
    ];
}

/**
 * Club Hub views; views beyond Overview and Manage Club arrive with the Club Hub phase.
 * Every member keeps Manage Club: it is read-only for them and carries Leave Club.
 */
export function clubNavigation(
    clubId: string,
    current: 'overview' | 'manage',
): readonly ShellNavigationItem[] {
    const hub = `/clubs/${clubId}`;
    return [
        { href: canonicalRoutes.product, label: 'Overview', current: current === 'overview' },
        { href: sectionHref(hub, 'sessions'), label: 'Sessions' },
        { href: sectionHref(hub, 'ratings'), label: 'Ratings' },
        { href: sectionHref(hub, 'members'), label: 'Members' },
        { href: sectionHref(hub, 'achievements'), label: 'Achievements' },
        { href: `${hub}/settings`, label: 'Manage Club', current: current === 'manage' },
    ];
}

export function mobileNavigation({
    admin,
    clubItems,
    currentArea,
    libraryItems,
    routes,
    settingsItems,
}: Readonly<{
    admin: boolean;
    clubItems: readonly ShellNavigationItem[];
    currentArea: ShellArea;
    libraryItems?: readonly ShellNavigationItem[] | undefined;
    routes: ShellRouteMap;
    settingsItems?: readonly ShellNavigationItem[] | undefined;
}>): readonly MobileNavigationEntry[] {
    const hubArea = currentArea === 'hub' || currentArea === 'session';
    const currentClubItem = hubArea ? clubItems.find((item) => item.current) : undefined;
    const hubItems: readonly ShellMenuItem[] =
        clubItems.length > 0
            ? clubItems.map((item) => ({ ...item, current: hubArea && item.current === true }))
            : [
                  { href: routes.createClub, label: 'Create a Club' },
                  { href: routes.joinClub, label: 'Join a Club' },
              ];

    return [
        {
            current: hubArea,
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
                { href: sectionHref(routes.library, 'my-ratings'), label: 'My Ratings' },
                { href: sectionHref(routes.library, 'watchlist'), label: 'Watchlist' },
                { href: sectionHref(routes.library, 'achievements'), label: 'Achievements' },
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
                    { href: sectionHref(routes.settings, 'notifications'), label: 'Notifications' },
                    { href: sectionHref(routes.settings, 'subscription'), label: 'Subscription' },
                    { href: routes.privacy, label: 'Privacy & data' },
                ]),
                signOutItem,
            ],
            label: 'Settings',
            name: 'Settings',
        },
    ];
}
