import { notFound } from 'next/navigation';

import AdminShell from '#components/shells/AdminShell/AdminShell';
import ControlShell from '#components/shells/ControlShell/ControlShell';
import ProductShell from '#components/shells/ProductShell/ProductShell';
import PublicShell from '#components/shells/PublicShell/PublicShell';
import SessionShell from '#components/shells/SessionShell/SessionShell';
import SetupShell from '#components/shells/SetupShell/SetupShell';
import type { IShellRouteMap } from '#components/shells/shell-navigation';
import Button from '#components/ui/Button/Button';
import ButtonLink from '#components/ui/Button/ButtonLink';
import TextInput from '#components/ui/TextInput/TextInput';

import DenseRegion from './_components/DenseRegion/DenseRegion';
import ShellPlaceholder from './_components/ShellPlaceholder/ShellPlaceholder';
import styles from './page.module.scss';

const shellNames = [
    'public',
    'setup',
    'product',
    'session',
    'settings',
    'library',
    'admin',
] as const;
type TShellName = (typeof shellNames)[number];
const adminShellNames = ['session-admin', 'settings-admin', 'library-admin'] as const;
type TAdminShellName = (typeof adminShellNames)[number];
type TPreviewShellName = TShellName | TAdminShellName;
const previewRoutes: IShellRouteMap = {
    admin: '/shell-preview/admin',
    contact: '/shell-preview/public#contact',
    createClub: '/shell-preview/setup',
    features: '/shell-preview/public#public-content',
    home: '/shell-preview',
    howItWorks: '/shell-preview/public#public-content',
    joinClub: '/shell-preview/setup',
    library: '/shell-preview/library',
    legalPrivacy: '/legal/privacy',
    legalTerms: '/legal/terms',
    pricing: '/shell-preview/public',
    privacy: '/shell-preview/settings?tab=privacy',
    product: '/shell-preview/product',
    session: '/shell-preview/session',
    settings: '/shell-preview/settings',
    setup: '/shell-preview/setup',
};

const previewClubItems = [
    { href: '/shell-preview/product#overview', label: 'Overview', icon: 'overview', current: true },
    { href: '/shell-preview/product#sessions', label: 'Sessions', icon: 'sessions' },
    { href: '/shell-preview/product#ratings', label: 'Ratings', icon: 'ratings' },
    { href: '/shell-preview/product#members', label: 'Members', icon: 'members' },
    { href: '/shell-preview/product#achievements', label: 'Achievements', icon: 'achievements' },
    { href: '/shell-preview/product#manage', label: 'Manage Club', icon: 'settings' },
] as const;

const previewAdminItems = [
    { href: '/shell-preview/admin#overview', label: 'Overview', icon: 'overview', current: true },
    { href: '/shell-preview/admin#users', label: 'Users', icon: 'members' },
    { href: '/shell-preview/admin#clubs', label: 'Clubs', icon: 'club-building' },
    { href: '/shell-preview/admin#application', label: 'Application settings', icon: 'settings' },
] as const;

function isPreviewShellName(value: string): value is TPreviewShellName {
    return [...shellNames, ...adminShellNames].some((name) => name === value);
}

function getShellVariant(shell: TPreviewShellName): { admin: boolean; shell: TShellName } {
    switch (shell) {
        case 'session-admin':
            return { admin: true, shell: 'session' };
        case 'settings-admin':
            return { admin: true, shell: 'settings' };
        case 'library-admin':
            return { admin: true, shell: 'library' };
        default:
            return { admin: false, shell };
    }
}

export function generateStaticParams() {
    return [...shellNames, ...adminShellNames].map((shell) => ({ shell }));
}

export default async function ShellPreviewPage({ params }: { params: Promise<{ shell: string }> }) {
    const { shell: previewShell } = await params;
    if (!isPreviewShellName(previewShell)) {
        notFound();
    }
    const { admin, shell } = getShellVariant(previewShell);

    switch (shell) {
        case 'public':
            return (
                <PublicShell routes={previewRoutes}>
                    <section aria-labelledby="public-shell-title" className={styles.publicHero}>
                        <p className={styles.eyebrow}>Public shell</p>
                        <h1 id="public-shell-title">
                            An editorial canvas for the public PickFlick story.
                        </h1>
                        <p>
                            Marketing, pricing, contact, and legal content inherit the same
                            responsive header, reading measure, action hierarchy, and footer.
                        </p>
                        <div className={styles.actions}>
                            <ButtonLink href="/shell-preview/setup" variant="primary">
                                Get started
                            </ButtonLink>
                            <ButtonLink href="#public-content">See the structure</ButtonLink>
                        </div>
                    </section>
                    <div className={styles.publicSections} id="public-content">
                        <ShellPlaceholder title="Editorial section">
                            <p>
                                Public feature content is supplied by Phase 3 inside this restrained
                                section rhythm.
                            </p>
                        </ShellPlaceholder>
                        <ShellPlaceholder title="Decision section">
                            <p>
                                Pricing or contact content can change composition without redefining
                                shared shell tokens.
                            </p>
                        </ShellPlaceholder>
                    </div>
                </PublicShell>
            );
        case 'setup':
            return (
                <SetupShell
                    description="Authentication, invitations, first-run setup, and focused forms share this compact composition."
                    routes={previewRoutes}
                    title="Begin with one clear task."
                >
                    <TextInput
                        id="setup-placeholder"
                        label="Named setup field"
                        placeholder="Feature-owned value"
                    />
                    <Button>Continue</Button>
                    <ButtonLink href="/shell-preview/public" variant="ghost">
                        Return to public shell
                    </ButtonLink>
                </SetupShell>
            );
        case 'product':
            return (
                <ProductShell
                    isAdmin
                    clubItems={previewClubItems}
                    currentArea="hub"
                    eyebrow="Authenticated product shell"
                    routes={previewRoutes}
                    title="Club context"
                >
                    <div className={styles.productGrid}>
                        <ShellPlaceholder title="Primary Club region">
                            <p>
                                The current Club, Session, phase, progress, and next action render
                                here.
                            </p>
                        </ShellPlaceholder>
                        <ShellPlaceholder title="Supporting region">
                            <p>
                                Authorized summaries keep their own loading, empty, error, and
                                read-only states.
                            </p>
                        </ShellPlaceholder>
                    </div>
                </ProductShell>
            );
        case 'session':
            return (
                <SessionShell isAdmin={admin} clubItems={previewClubItems} routes={previewRoutes}>
                    <div className={styles.sessionGrid}>
                        <ShellPlaceholder title="Phase content">
                            <p>
                                Nomination, Selection, Watching, Rating, or Completed behavior
                                replaces this slot without changing the outer Session shell.
                            </p>
                        </ShellPlaceholder>
                        <ShellPlaceholder title="Session details">
                            <p id="session-details">
                                Metrics and detail rows retain one geometry across every Session
                                phase.
                            </p>
                        </ShellPlaceholder>
                    </div>
                </SessionShell>
            );
        case 'settings':
            return (
                <ControlShell
                    isAdmin={admin}
                    clubItems={previewClubItems}
                    currentArea="settings"
                    description="Personal controls keep a stable reading width and move section navigation into a mobile menu."
                    items={[
                        {
                            href: '/shell-preview/settings',
                            label: 'Profile',
                            icon: 'profile',
                            current: true,
                        },
                        {
                            href: '/shell-preview/settings?tab=notifications',
                            label: 'Notifications',
                            icon: 'bell',
                        },
                        {
                            href: '/shell-preview/settings?tab=subscription',
                            label: 'Subscription',
                            icon: 'credit-card',
                        },
                        {
                            href: '/shell-preview/settings?tab=privacy',
                            label: 'Privacy & data',
                            icon: 'privacy',
                        },
                        {
                            href: '/shell-preview/settings?tab=import-export',
                            label: 'Import & Export',
                            icon: 'import-export',
                        },
                    ]}
                    routes={previewRoutes}
                    title="Settings"
                >
                    <ShellPlaceholder title="Settings panel">
                        <p>
                            Each settings section renders forms and stable feedback inside this
                            content column.
                        </p>
                    </ShellPlaceholder>
                </ControlShell>
            );
        case 'library':
            return (
                <ControlShell
                    isAdmin={admin}
                    clubItems={previewClubItems}
                    currentArea="library"
                    description="Personal film memory uses the product chrome, local views, and bounded dense regions."
                    items={[
                        {
                            href: '/shell-preview/library?tab=my-ratings',
                            label: 'My Ratings',
                            icon: 'ratings',
                            current: true,
                        },
                        {
                            href: '/shell-preview/library?tab=watchlist',
                            label: 'Watchlist',
                            icon: 'watchlist',
                        },
                        {
                            href: '/shell-preview/library?tab=achievements',
                            label: 'Achievements',
                            icon: 'achievements',
                        },
                    ]}
                    routes={previewRoutes}
                    title="My Library"
                >
                    <ShellPlaceholder title="Library content">
                        <p className={styles.regionIntro}>
                            Search, filters, statistics, and feature-owned data sit above a locally
                            scrollable dense region.
                        </p>
                        <DenseRegion label="Library results preview" />
                    </ShellPlaceholder>
                </ControlShell>
            );
        case 'admin':
            return (
                <AdminShell
                    clubItems={previewClubItems}
                    items={previewAdminItems}
                    routes={previewRoutes}
                >
                    <div className={styles.adminGrid}>
                        <ShellPlaceholder title="Operational overview">
                            <p>
                                Privacy-safe metrics and activity summaries render here after the
                                App Admin boundary is enforced.
                            </p>
                        </ShellPlaceholder>
                        <ShellPlaceholder title="Administration table">
                            <p className={styles.regionIntro}>
                                Searchable operational rows remain contained on narrow screens.
                            </p>
                            <DenseRegion label="Administration results preview" />
                        </ShellPlaceholder>
                    </div>
                </AdminShell>
            );
    }
}
