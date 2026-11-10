'use client';

import { useForm } from '@mantine/form';
import { appearanceSchema, type TAppearance } from '@pickflick/contracts';
import { useState, useTransition } from 'react';

import { useAccount, useAppearance } from '#components/account/account-context';
import { saveAppearance } from '#components/account/actions';
import TableColumns from '#components/account/TableColumns/TableColumns';
import Button from '#components/ui/Button/Button';
import InfoTip from '#components/ui/InfoTip/InfoTip';
import Select from '#components/ui/Select/Select';
import Switch from '#components/ui/Switch/Switch';
import { getOfflineMessage } from '#lib/offline';

import styles from '../../page.module.scss';

export default function AppearanceForm() {
    const { setAccount } = useAccount();
    const saved = useAppearance();
    const [message, setMessage] = useState('');
    const form = useForm<TAppearance>({
        initialValues: saved,
        onValuesChange: () => setMessage(''),
        validate: (values) =>
            appearanceSchema.safeParse(values).success
                ? {}
                : { listSpacing: 'Review your appearance settings.' },
    });
    const appearance = form.values;
    const [isPending, startTransition] = useTransition();
    return (
        <form
            className={styles.card}
            onSubmit={form.onSubmit((values) => {
                const offline = getOfflineMessage();
                if (offline) {
                    setMessage(offline);
                    return;
                }
                startTransition(async () => {
                    const result = await saveAppearance(values);
                    if (result.ok) {
                        setAccount(result.data);
                        setMessage('Appearance saved.');
                    } else setMessage(result.message);
                });
            })}
        >
            <h2>Appearance</h2>
            <p>Personal display preferences apply across your Hub, Sessions and My Library.</p>
            <Switch
                label="Black-and-white posters and trailers"
                checked={appearance.monochrome}
                disabled={isPending}
                onChange={(event) =>
                    form.setValues({ ...appearance, monochrome: event.currentTarget.checked })
                }
            />
            <Switch
                label="Color reveal"
                description="Soft color diffusion from the pointer. Turn off for ordinary hover feedback."
                checked={appearance.colorReveal}
                disabled={isPending}
                onChange={(event) =>
                    form.setValues({ ...appearance, colorReveal: event.currentTarget.checked })
                }
            />
            <div className={styles.quiet}>
                <Switch
                    label="Quiet mode"
                    checked={appearance.quietMode}
                    disabled={isPending}
                    onChange={(event) =>
                        form.setValues({ ...appearance, quietMode: event.currentTarget.checked })
                    }
                />
                <InfoTip label="About quiet mode">
                    Removes decorative grain and ambient motion. Focus, loading, selection and
                    success feedback stay visible.
                </InfoTip>
            </div>
            <Select
                error={form.errors.listSpacing}
                id="list-spacing"
                label="List spacing"
                value={appearance.listSpacing}
                disabled={isPending}
                data={[
                    { value: 'comfortable', label: 'Comfortable' },
                    { value: 'compact', label: 'Compact' },
                ]}
                onChange={(value) =>
                    form.setValues({
                        ...appearance,
                        listSpacing: value === 'compact' ? 'compact' : 'comfortable',
                    })
                }
            />
            <TableColumns
                hiddenColumns={appearance.hiddenColumns}
                disabled={isPending}
                onChange={(hiddenColumns) => form.setValues({ ...appearance, hiddenColumns })}
            />
            <div className={styles.actions}>
                <Button type="submit" loading={isPending}>
                    Save appearance
                </Button>
            </div>
            <p className={styles.feedback} role="status">
                {message}
            </p>
        </form>
    );
}
