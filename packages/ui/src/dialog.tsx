'use client';

import { Modal as MantineModal } from '@mantine/core';
import type { ReactNode } from 'react';

export interface DialogProps {
    readonly open: boolean;
    readonly title: string;
    readonly children: ReactNode;
    readonly actions?: ReactNode;
    readonly onClose: () => void;
    readonly dismissible?: boolean;
    readonly tone?: 'neutral' | 'danger';
}

export function Dialog({
    actions,
    children,
    dismissible = true,
    onClose,
    open,
    title,
    tone = 'neutral',
}: DialogProps) {
    return (
        <MantineModal
            centered
            classNames={{
                body: 'pf-dialog__body',
                close: 'pf-dialog__close',
                content: tone === 'danger' ? 'pf-dialog pf-dialog--danger' : 'pf-dialog',
                header: 'pf-dialog__header',
                inner: 'pf-dialog__inner',
                overlay: 'pf-dialog__overlay',
                root: 'pf-dialog__root',
                title: 'pf-dialog__title',
            }}
            closeButtonProps={{ 'aria-label': 'Close dialog' }}
            closeOnClickOutside={dismissible}
            closeOnEscape={dismissible}
            onClose={onClose}
            opened={open}
            padding={0}
            returnFocus
            size="min(560px, calc(100vw - 32px))"
            title={title}
            transitionProps={{ duration: 200, transition: 'fade-down' }}
            trapFocus
            unstyled
            withCloseButton={dismissible}
        >
            <div className="pf-dialog__content">{children}</div>
            {actions ? <div className="pf-dialog__actions">{actions}</div> : null}
        </MantineModal>
    );
}
