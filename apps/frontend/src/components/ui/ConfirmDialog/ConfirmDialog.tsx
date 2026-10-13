'use client';

import { type ReactNode, useState } from 'react';

import Button from '@/components/ui/Button/Button';
import Modal from '@/components/ui/Modal/Modal';
import TextInput from '@/components/ui/TextInput/TextInput';

export interface IConfirmDialogProps {
    open: boolean;
    title: string;
    /** The exact text the user types to enable confirmation, such as CANCEL or a Club name. */
    word: string;
    inputId: string;
    confirmLabel: string;
    cancelLabel?: string;
    pending: boolean;
    tone?: 'neutral' | 'danger';
    /** Live feedback from the last attempt, rendered inside the dialog. */
    status?: ReactNode;
    children: ReactNode;
    onConfirm: (confirmation: string) => void;
    onClose: () => void;
    onExitTransitionEnd?: () => void;
}

/** A dialog that asks the user to type a word before a consequential action. */
export default function ConfirmDialog({
    cancelLabel = 'Cancel',
    children,
    confirmLabel,
    inputId,
    onClose,
    onConfirm,
    onExitTransitionEnd,
    open,
    pending,
    status,
    title,
    tone = 'danger',
    word,
}: IConfirmDialogProps) {
    const [confirmation, setConfirmation] = useState('');
    const [wasOpen, setWasOpen] = useState(open);
    if (wasOpen !== open) {
        setWasOpen(open);
        if (open) setConfirmation('');
    }
    return (
        <Modal
            actions={
                <>
                    <Button disabled={pending} onClick={onClose} variant="secondary">
                        {cancelLabel}
                    </Button>
                    <Button
                        disabled={confirmation !== word}
                        loading={pending}
                        onClick={() => onConfirm(confirmation)}
                        variant={tone === 'danger' ? 'danger' : 'primary'}
                    >
                        {confirmLabel}
                    </Button>
                </>
            }
            dismissible={!pending}
            onClose={onClose}
            onExitTransitionEnd={onExitTransitionEnd}
            open={open}
            title={title}
            tone={tone}
        >
            {children}
            <TextInput
                autoComplete="off"
                disabled={pending}
                id={inputId}
                label={`Type ${word} to confirm`}
                onChange={(event) => setConfirmation(event.currentTarget.value)}
                value={confirmation}
            />
            {status}
        </Modal>
    );
}
