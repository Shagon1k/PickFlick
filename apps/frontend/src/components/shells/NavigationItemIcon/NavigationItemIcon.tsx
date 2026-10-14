import styles from '#components/shells/product-navigation.module.scss';
import Icon, { type TIconName } from '#components/ui/Icon/Icon';

interface INavigationItemIconProps {
    label: string;
}

export default function NavigationItemIcon({ label }: INavigationItemIconProps) {
    const iconByLabel: Record<string, TIconName> = {
        'Admin Panel': 'admin',
        'Application settings': 'settings',
        'Contact Us': 'contact',
        'Create a Club': 'overview',
        'Import & Export': 'import-export',
        'Join a Club': 'user-plus',
        'Manage Club': 'settings',
        'My Library': 'book',
        'My Ratings': 'ratings',
        Achievements: 'achievements',
        Clubs: 'club-building',
        Manage: 'settings',
        Members: 'members',
        Notifications: 'bell',
        Overview: 'overview',
        Pricing: 'pricing',
        Privacy: 'privacy',
        'Privacy & data': 'privacy',
        Profile: 'profile',
        Ratings: 'ratings',
        Sessions: 'sessions',
        Settings: 'settings',
        'Sign out': 'sign-out',
        Subscription: 'credit-card',
        Users: 'members',
        Watchlist: 'watchlist',
    };

    return <Icon className={styles.menuIcon} name={iconByLabel[label] ?? 'circle'} />;
}
