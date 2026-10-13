'use client';

import { type ReactNode, useId, useState } from 'react';

import Button from '@/components/ui/Button/Button';
import Modal from '@/components/ui/Modal/Modal';
import TextInput from '@/components/ui/TextInput/TextInput';

import styles from './TypedConfirmation.module.scss';

interface ITypedConfirmationProps {
    open: boolean;
    title: string;
    confirmation: string;
    confirmLabel: string;
    cancelLabel?: string;
    pending: boolean;
    onClose: () => void;
    onExitTransitionEnd?: () => void;
    onConfirm: (data: FormData) => void | Promise<void>;
    children: ReactNode;
    status: ReactNode;
    tone?: 'danger' | 'neutral';
}
export default function TypedConfirmation({
    open,
    title,
    confirmation,
    confirmLabel,
    cancelLabel = 'Cancel',
    pending,
    onClose,
    onExitTransitionEnd,
    onConfirm,
    children,
    status,
    tone = 'danger',
}: ITypedConfirmationProps) {
    const id = useId();
    const [value, setValue] = useState('');
    const [wasOpen, setWasOpen] = useState(open);
    if (wasOpen !== open) {
        setWasOpen(open);
        setValue('');
    }
    return (
        <Modal
            open={open}
            title={title}
            tone={tone}
            dismissible={!pending}
            onClose={onClose}
            onExitTransitionEnd={onExitTransitionEnd}
            actions={
                <>
                    <Button disabled={pending} onClick={onClose} variant="secondary">
                        {cancelLabel}
                    </Button>
                    <Button
                        form={id}
                        type="submit"
                        loading={pending}
                        disabled={value !== confirmation}
                        variant={tone === 'danger' ? 'danger' : 'primary'}
                    >
                        {confirmLabel}
                    </Button>
                </>
            }
        >
            <form id={id} action={onConfirm} className={styles.form}>
                {children}
                <TextInput
                    id={`${id}-confirmation`}
                    autoComplete="off"
                    label={`Type ${confirmation} to confirm`}
                    name="confirmation"
                    required
                    disabled={pending}
                    value={value}
                    onChange={(event) => setValue(event.currentTarget.value)}
                />
                {status}
            </form>
        </Modal>
    );
}
