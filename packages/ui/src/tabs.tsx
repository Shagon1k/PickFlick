'use client';

import { Tabs as MantineTabs } from '@mantine/core';
import { useState, type ReactNode } from 'react';

export interface TabItem {
    readonly id: string;
    readonly label: string;
    readonly content: ReactNode;
    readonly disabled?: boolean;
}

export interface TabsProps {
    readonly items: readonly TabItem[];
    readonly label: string;
    readonly initialId?: string;
}

export function Tabs({ initialId, items, label }: TabsProps) {
    const enabledIds = items.filter((item) => !item.disabled).map((item) => item.id);
    const firstEnabledId = enabledIds[0] ?? null;
    const initialValue = initialId && enabledIds.includes(initialId) ? initialId : firstEnabledId;
    const [selectedValue, setSelectedValue] = useState(initialValue);
    const resolvedValue =
        selectedValue && enabledIds.includes(selectedValue) ? selectedValue : firstEnabledId;

    if (selectedValue !== resolvedValue) {
        setSelectedValue(resolvedValue);
    }

    return (
        <MantineTabs
            activateTabWithKeyboard={false}
            classNames={{
                list: 'pf-tabs__list',
                panel: 'pf-tabs__panel',
                root: 'pf-tabs',
                tab: 'pf-tabs__tab',
            }}
            keepMounted
            onChange={setSelectedValue}
            unstyled
            value={resolvedValue}
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
