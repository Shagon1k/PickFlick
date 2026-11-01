'use client';

import { Popover } from '@mantine/core';
import { type ReactNode, useId, useState } from 'react';

import styles from './InfoTip.module.scss';

const TOOLTIP_OFFSET = 10;
const EDGE_GAP = 8;
const TOOLTIP_Z_INDEX = 300;

export interface IInfoTipProps {
    label: string;
    children: ReactNode;
}

/** A small explanation that escapes clipped cards and stays inside the viewport. */
export default function InfoTip({ children, label }: IInfoTipProps) {
    const tipId = useId();
    const [isOpen, setIsOpen] = useState(false);
    return (
        <span
            className={styles.infoTip}
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
        >
            <Popover
                id={tipId}
                floatingStrategy="fixed"
                opened={isOpen}
                onChange={setIsOpen}
                position="top"
                offset={TOOLTIP_OFFSET}
                width="max-content"
                middlewares={{ flip: true, shift: { padding: EDGE_GAP } }}
                zIndex={TOOLTIP_Z_INDEX}
                keepMounted
                withRoles={false}
                returnFocus={false}
                withinPortal={false}
                unstyled
            >
                <Popover.Target>
                    <button
                        aria-describedby={`${tipId}-dropdown`}
                        aria-expanded={isOpen}
                        aria-label={label}
                        className={styles.infoTip__trigger}
                        onBlur={() => setIsOpen(false)}
                        onClick={() => setIsOpen(true)}
                        onFocus={() => setIsOpen(true)}
                        onKeyDown={(event) => {
                            if (event.key === 'Escape' && isOpen) {
                                event.stopPropagation();
                                setIsOpen(false);
                            }
                        }}
                        type="button"
                    >
                        i
                    </button>
                </Popover.Target>
                <Popover.Dropdown
                    className={styles.infoTip__bubble}
                    id={`${tipId}-dropdown`}
                    role="tooltip"
                >
                    {children}
                </Popover.Dropdown>
            </Popover>
        </span>
    );
}
