'use client';

import { useState } from 'react';

import FilmStripMenu from '@/components/ui/FilmStripMenu/FilmStripMenu';

import styles from '../../page.module.scss';

export default function PreviewMenus() {
    const [selectedAction, setSelectedAction] = useState('No action selected');

    return (
        <>
            <div className={styles.menuRow}>
                <FilmStripMenu
                    items={[
                        { id: 'overview', label: 'Overview', href: '#navigation', current: true },
                        { id: 'settings', label: 'Settings', href: '#forms' },
                        {
                            id: 'leave',
                            label: 'Leave Club',
                            onSelect: () => setSelectedAction('Leave Club selected'),
                            danger: true,
                        },
                    ]}
                    menuLabel="Club menu"
                    triggerLabel="Open Club menu"
                />
                <FilmStripMenu
                    items={[
                        { id: 'profile', label: 'Profile', href: '#forms' },
                        {
                            id: 'sign-out',
                            label: 'Sign out',
                            onSelect: () => setSelectedAction('Sign out selected'),
                            danger: true,
                        },
                    ]}
                    menuLabel="Account menu"
                    triggerLabel="Open account menu"
                />
            </div>
            <output aria-live="polite" data-menu-action>
                {selectedAction}
            </output>
        </>
    );
}
