'use client';

import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import { CLUB_DESCRIPTION_MAX_LENGTH, CLUB_NAME_MAX_LENGTH } from '@pickflick/contracts';
import { Button, TextAreaField, TextField } from '@pickflick/ui';

import { createClub } from '../../app/clubs/new/actions';
import { initialFormActionState } from '../forms/form-action.types';
import { useFormAction } from '../forms/use-form-action';
import type { ClubFieldErrors, ClubFieldName, ClubFormValues } from './club-form.types';
import { validateClubValues } from './club-form.validation';
import styles from './create-club.module.css';
import { SelectionScaleField } from './selection-scale-field';

const initialValues: ClubFormValues = {
    name: '',
    description: '',
    selectionScaleMin: '0',
    selectionScaleMax: '5',
};

export function CreateClubForm() {
    const [values, setValues] = useState<ClubFormValues>(initialValues);
    const [errors, setErrors] = useState<ClubFieldErrors>({});
    const [feedback, setFeedback] = useState({ message: '', tone: 'neutral' });
    const formRef = useRef<HTMLFormElement>(null);
    const [actionState, formAction, pending] = useFormAction(
        createClub,
        initialFormActionState<ClubFieldName>(),
        "We couldn't reach PickFlick. Your entries are still here — try again.",
    );

    useEffect(() => {
        if (actionState.revision === 0) {
            return;
        }
        setErrors(actionState.fieldErrors ?? {});
        setFeedback({ message: actionState.message, tone: actionState.tone });
        if (actionState.status === 'success') {
            window.location.assign('/app');
        } else if (actionState.fieldErrors) {
            focusFirstError();
        }
    }, [actionState]);

    function update(field: ClubFieldName, value: string): void {
        setValues((current) => ({ ...current, [field]: value }));
        setErrors((current) => {
            const next = { ...current };
            delete next[field];
            return next;
        });
        setFeedback({ message: '', tone: 'neutral' });
    }

    function focusFirstError(): void {
        requestAnimationFrame(() => {
            formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
        });
    }

    function submit(event: FormEvent<HTMLFormElement>): void {
        const nextErrors = validateClubValues(values);
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) {
            event.preventDefault();
            setFeedback({
                message: 'Review the highlighted fields and try again.',
                tone: 'danger',
            });
            focusFirstError();
            return;
        }
        if (!navigator.onLine) {
            event.preventDefault();
            setFeedback({
                message:
                    'You appear to be offline. Reconnect, then try again; your entries are still here.',
                tone: 'warning',
            });
            return;
        }
        setFeedback({ message: 'Creating your Club…', tone: 'neutral' });
    }

    return (
        <form
            action={formAction}
            className={styles.form}
            noValidate
            onSubmit={submit}
            ref={formRef}
        >
            <TextField
                {...(errors.name ? { error: errors.name } : {})}
                autoComplete="organization"
                disabled={pending}
                id="club-name"
                label="Club name"
                labelHint="required"
                maxLength={CLUB_NAME_MAX_LENGTH}
                name="name"
                onChange={(event) => update('name', event.currentTarget.value)}
                placeholder="e.g. Friday Night Film Club"
                required
                value={values.name}
            />
            <TextAreaField
                {...(errors.description ? { error: errors.description } : {})}
                disabled={pending}
                hint={`${values.description.length}/${CLUB_DESCRIPTION_MAX_LENGTH}`}
                id="club-description"
                label="Description"
                labelHint="optional"
                maxLength={CLUB_DESCRIPTION_MAX_LENGTH}
                name="description"
                onChange={(event) => update('description', event.currentTarget.value)}
                placeholder="What kind of films does your Club watch?"
                value={values.description}
            />

            <div className={styles.scaleSection}>
                <SelectionScaleField
                    defaultMax={Number(initialValues.selectionScaleMax)}
                    disabled={pending}
                    idPrefix="selection-scale"
                    maxError={errors.selectionScaleMax ?? errors.selectionScaleMin}
                    min={Number(initialValues.selectionScaleMin)}
                    onChange={(max) => update('selectionScaleMax', String(max))}
                />
            </div>

            <div className={styles.submitZone}>
                <Button className={styles.submitButton} loading={pending} type="submit">
                    Create Screening Room
                </Button>
                <p
                    aria-atomic="true"
                    aria-live="polite"
                    className={styles.feedback}
                    data-tone={feedback.tone}
                    role="status"
                >
                    {feedback.message}
                </p>
            </div>
        </form>
    );
}
