'use client';

import { Modal as MantineModal } from '@mantine/core';
import clsx from 'clsx';
import type { ReactNode } from 'react';

import styles from './Modal.module.scss';

const FADE_DURATION_MS = 200;

export interface IModalProps {
    open: boolean;
    title: string;
    children: ReactNode;
    actions?: ReactNode;
    onClose: () => void;
    onExitTransitionEnd?: () => void;
    dismissible?: boolean;
    tone?: 'neutral' | 'danger';
}

export default function Modal({
    actions,
    children,
    dismissible = true,
    onClose,
    onExitTransitionEnd,
    open,
    title,
    tone = 'neutral',
}: IModalProps) {
    return (
        <MantineModal
            centered
            classNames={{
                root: styles.modal__root,
                overlay: styles.modal__overlay,
                inner: styles.modal__inner,
                content: clsx(styles.modal, tone === 'danger' && styles['m-danger']),
                header: styles.modal__header,
                title: styles.modal__title,
                body: styles.modal__body,
            }}
            closeOnClickOutside={dismissible}
            closeOnEscape={dismissible}
            onClose={onClose}
            onExitTransitionEnd={onExitTransitionEnd}
            opened={open}
            padding={0}
            returnFocus
            size="min(440px, calc(100vw - 32px))"
            title={title}
            transitionProps={{ duration: FADE_DURATION_MS, transition: 'fade-down' }}
            trapFocus
            unstyled
            // The prototype dialog closes through its own actions, Escape, or the overlay.
            withCloseButton={false}
        >
            <div className={styles.modal__content}>{children}</div>
            {actions ? <div className={styles.modal__actions}>{actions}</div> : null}
        </MantineModal>
    );
}
