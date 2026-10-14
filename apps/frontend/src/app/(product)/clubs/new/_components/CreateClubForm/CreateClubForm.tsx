'use client';

import { useForm } from '@mantine/form';
import { CLUB_DESCRIPTION_MAX_LENGTH, CLUB_NAME_MAX_LENGTH } from '@pickflick/contracts';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import type { IClubFormValues } from '@/components/clubs/club-form.types';
import { validateClubValues } from '@/components/clubs/club-form.validation';
import SelectionScaleField from '@/components/clubs/SelectionScaleField/SelectionScaleField';
import Button from '@/components/ui/Button/Button';
import Textarea from '@/components/ui/Textarea/Textarea';
import TextInput from '@/components/ui/TextInput/TextInput';
import { focusFirstInvalid, type TFeedbackTone, type TFormResult } from '@/lib/form-errors';

import { createClubAction } from '../../actions';
import styles from './CreateClubForm.module.scss';

const IDLE = { message: '', tone: 'neutral' as TFeedbackTone };
const INITIAL_VALUES: IClubFormValues = {
    name: '',
    description: '',
    selectionScaleMin: '0',
    selectionScaleMax: '5',
};

export default function CreateClubForm() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [feedback, setFeedback] = useState(IDLE);
    const form = useForm<IClubFormValues>({
        initialValues: INITIAL_VALUES,
        validate: validateClubValues,
        onValuesChange: () => setFeedback(IDLE),
    });

    const handleSubmit = form.onSubmit(
        (values, event) => {
            const formElement = event?.currentTarget;
            if (!navigator.onLine) {
                setFeedback({
                    message:
                        'You appear to be offline. Reconnect, then try again; your entries are still here.',
                    tone: 'warning',
                });
                return;
            }
            setFeedback({ message: 'Creating your Club…', tone: 'neutral' });
            startTransition(async () => {
                const result: TFormResult<keyof IClubFormValues> = await createClubAction(
                    values,
                ).catch(() => ({
                    ok: false as const,
                    message:
                        "We couldn't reach PickFlick. Your entries are still here — try again.",
                    tone: 'danger' as const,
                }));
                if (result.ok) {
                    setFeedback({
                        message: 'Club created. Opening your screening room…',
                        tone: 'success',
                    });
                    router.push('/app');
                    return;
                }
                setFeedback({ message: result.message, tone: result.tone });
                if (result.fieldErrors) {
                    form.setErrors(result.fieldErrors);
                    focusFirstInvalid(formElement);
                }
            });
        },
        (_errors, _values, event) => {
            setFeedback({
                message: 'Review the highlighted fields and try again.',
                tone: 'danger',
            });
            focusFirstInvalid(event?.currentTarget);
        },
    );

    return (
        <form className={styles.form} noValidate onSubmit={handleSubmit}>
            <TextInput
                {...form.getInputProps('name')}
                autoComplete="organization"
                disabled={isPending}
                id="club-name"
                label="Club name"
                labelHint="required"
                maxLength={CLUB_NAME_MAX_LENGTH}
                placeholder="e.g. Friday Night Film Club"
                required
            />
            <Textarea
                {...form.getInputProps('description')}
                disabled={isPending}
                id="club-description"
                label="Description"
                labelHint="optional"
                maxLength={CLUB_DESCRIPTION_MAX_LENGTH}
                placeholder="What kind of films does your Club watch?"
                showCount
                size="compact"
            />

            <div className={styles.scaleSection}>
                <SelectionScaleField
                    defaultMax={Number(INITIAL_VALUES.selectionScaleMax)}
                    disabled={isPending}
                    idPrefix="selection-scale"
                    maxError={form.errors.selectionScaleMax ?? form.errors.selectionScaleMin}
                    min={Number(INITIAL_VALUES.selectionScaleMin)}
                    onChange={(max) => form.setFieldValue('selectionScaleMax', String(max))}
                />
            </div>

            <div className={styles.submitZone}>
                <Button fullWidth loading={isPending} type="submit">
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
