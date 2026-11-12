import { HTTP_STATUS, type IAccountProfile } from '@pickflick/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getAccount } from '#api/account.server';
import { buildLoginPath, getSessionState } from '#api/auth-session.server';
import ProductChrome from '#components/shells/ProductChrome/ProductChrome';
import RetryButton from '#components/shells/RetryButton/RetryButton';
import Avatar from '#components/ui/Avatar/Avatar';
import Icon from '#components/ui/Icon/Icon';
import { ApiError } from '#lib/api.server';

import AppearanceForm from './_components/AppearanceForm/AppearanceForm';
import ProfileForm from './_components/ProfileForm/ProfileForm';
import SettingsSignOut from './_components/SettingsSignOut';
import styles from './page.module.scss';

export const metadata: Metadata = {
    title: 'Settings — PickFlick',
    robots: { index: false, follow: false },
};
const ITEMS = [
    { label: 'Profile', href: '/settings', icon: 'profile' as const },
    { label: 'Appearance', href: '/settings?tab=appearance', icon: 'settings' as const },
    { label: 'Notifications', href: '/settings?tab=notifications', icon: 'bell' as const },
    { label: 'Subscription', href: '/settings?tab=subscription', icon: 'pricing' as const },
    { label: 'Privacy & data', href: '/settings?tab=privacy', icon: 'privacy' as const },
    {
        label: 'Import & Export',
        href: '/settings?tab=import-export',
        icon: 'import-export' as const,
    },
];

export default async function SettingsPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const { tab } = await searchParams;
    if ((await getSessionState()) === 'anonymous') redirect(buildLoginPath('/settings'));
    let account = null;
    try {
        account = await getAccount();
    } catch (error) {
        if (
            !(
                error instanceof ApiError ||
                error instanceof TypeError ||
                (error instanceof DOMException && error.name === 'TimeoutError')
            )
        )
            throw error;
        if (error instanceof ApiError && error.status === HTTP_STATUS.UNAUTHORIZED)
            redirect(buildLoginPath('/settings'));
        console.error('Settings profile could not be loaded.');
    }
    const currentHref =
        typeof tab === 'string' && tab !== 'profile' ? `/settings?tab=${tab}` : '/settings';
    const items = ITEMS.map((item) => ({ ...item, current: item.href === currentHref }));
    return (
        <ProductChrome clubItems={[]} currentArea="settings" settingsItems={items}>
            <main className={styles.settings}>
                <header className={styles.settings__heading}>
                    <div>
                        <h1>Settings</h1>
                        <p>
                            Manage your profile, notifications, subscription, privacy, and personal
                            data.
                        </p>
                    </div>
                    {account ? (
                        <div className={styles.settings__context}>
                            <strong>{account.displayName}</strong>
                            <span>Personal account</span>
                        </div>
                    ) : null}
                </header>
                <div className={styles.settings__layout}>
                    <aside className={styles.settings__sidebar}>
                        {account ? (
                            <div className={styles.settings__user}>
                                <Avatar
                                    name={account.displayName}
                                    src={account.avatarUrl}
                                    size="large"
                                />
                                <div>
                                    <strong>{account.displayName}</strong>
                                    <p>{account.email}</p>
                                </div>
                            </div>
                        ) : null}
                        <nav aria-label="Settings sections">
                            {items.map((item) => (
                                <Link
                                    href={item.href}
                                    key={item.label}
                                    aria-current={item.current ? 'page' : undefined}
                                >
                                    <Icon name={item.icon} />
                                    {item.label}
                                </Link>
                            ))}
                        </nav>
                        <SettingsSignOut />
                    </aside>
                    <div className={styles.settings__content}>
                        <SettingsContent
                            account={account}
                            tab={tab}
                            title={items.find((item) => item.current)?.label ?? 'Settings'}
                        />
                    </div>
                </div>
            </main>
        </ProductChrome>
    );
}

function SettingsContent({
    account,
    tab,
    title,
}: {
    account: IAccountProfile | null;
    tab: string | string[] | undefined;
    title: string;
}) {
    if (!account)
        return (
            <section className={styles.card} aria-label="Settings unavailable">
                <h2>Settings unavailable</h2>
                <RetryButton />
            </section>
        );
    if (tab === 'appearance') return <AppearanceForm appearance={account.appearance} />;
    if (!tab || tab === 'profile') return <ProfileForm account={account} />;
    return (
        <section className={styles.card}>
            <h2>{title}</h2>
            <p>This section is not available yet.</p>
        </section>
    );
}
