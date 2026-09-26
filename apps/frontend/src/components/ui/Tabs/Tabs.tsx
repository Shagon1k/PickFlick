'use client';

import { Tabs as MantineTabs } from '@mantine/core';
import { type ReactNode, useState } from 'react';

import styles from './Tabs.module.scss';

interface ITabItem {
    id: string;
    label: string;
    content: ReactNode;
    disabled?: boolean;
}

export interface ITabsProps {
    items: ITabItem[];
    label: string;
    initialId?: string;
}

export default function Tabs({ initialId, items, label }: ITabsProps) {
    const enabledIds = items.filter((item) => !item.disabled).map((item) => item.id);
    const firstEnabledId = enabledIds[0] ?? null;
    const [selectedId, setSelectedId] = useState(
        initialId && enabledIds.includes(initialId) ? initialId : firstEnabledId,
    );
    // A tab that becomes disabled hands the selection to the first enabled one.
    const value = selectedId && enabledIds.includes(selectedId) ? selectedId : firstEnabledId;

    return (
        <MantineTabs
            activateTabWithKeyboard={false}
            classNames={{
                root: styles.tabs,
                list: styles.tabs__list,
                tab: styles.tabs__tab,
                panel: styles.tabs__panel,
            }}
            keepMounted
            onChange={setSelectedId}
            unstyled
            value={value}
        >
            <MantineTabs.List aria-label={label}>
                {items.map((item) => (
                    <MantineTabs.Tab disabled={item.disabled} key={item.id} value={item.id}>
                        {item.label}
                    </MantineTabs.Tab>
                ))}
            </MantineTabs.List>
            {items.map((item) => (
                <MantineTabs.Panel key={item.id} tabIndex={0} value={item.id}>
                    {item.content}
                </MantineTabs.Panel>
            ))}
        </MantineTabs>
    );
}
