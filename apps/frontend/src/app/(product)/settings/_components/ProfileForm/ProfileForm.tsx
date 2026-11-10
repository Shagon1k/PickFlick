'use client';

import { useForm } from '@mantine/form';
import {
    ACCOUNT_AVATAR_MAX_BYTES,
    DISPLAY_NAME_MAX_LENGTH,
    type IAccountProfile,
    type TUpdateProfile,
    updateProfileSchema,
} from '@pickflick/contracts';
import { useRef, useState, useTransition } from 'react';

import { useAccount } from '#components/account/account-context';
import { deleteAvatar, saveAvatar, saveProfile } from '#components/account/actions';
import Avatar from '#components/ui/Avatar/Avatar';
import Button from '#components/ui/Button/Button';
import TextInput from '#components/ui/TextInput/TextInput';
import { focusFirstInvalid } from '#lib/form-errors';
import { getOfflineMessage } from '#lib/offline';

import styles from '../../page.module.scss';

export default function ProfileForm({ account }: { account: IAccountProfile }) {
    const fileRef = useRef<HTMLInputElement>(null);
    const { setAccount } = useAccount();
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState('');
    const form = useForm<TUpdateProfile>({
        initialValues: { displayName: account.displayName, locale: 'en' },
        onValuesChange: () => setMessage(''),
        validate: (values) =>
            updateProfileSchema.safeParse(values).success
                ? {}
                : { displayName: 'Enter a display name between 1 and 80 characters.' },
    });
    function submit(action: () => ReturnType<typeof saveProfile>, success: string) {
        const offline = getOfflineMessage();
        if (offline) {
            setMessage(offline);
            return;
        }
        startTransition(async () => {
            const result = await action();
            if (result.ok) {
                setAccount(result.data);
                setMessage(success);
            } else setMessage(result.message);
        });
    }
    const providerLabel =
        account.providers
            .map((provider) => {
                if (provider === 'google') return 'Google';
                if (provider === 'apple') return 'Apple';
                return provider;
            })
            .join(' and ') || 'your sign-in provider';
    return (
        <section className={styles.card} aria-labelledby="profile-heading">
            <h2 id="profile-heading">Profile</h2>
            <div className={styles.avatar}>
                <div className={styles.avatar__preview}>
                    <Avatar
                        key={account.avatarUrl}
                        name={account.displayName}
                        src={account.avatarUrl}
                        size="profile"
                    />
                </div>
                <div className={styles.avatar__actions}>
                    <Button
                        variant="secondary"
                        disabled={isPending}
                        onClick={() => fileRef.current?.click()}
                    >
                        Change photo
                    </Button>
                    <label className="visually-hidden" htmlFor="profile-avatar">
                        Change photo
                    </label>
                    <input
                        className="visually-hidden"
                        ref={fileRef}
                        tabIndex={-1}
                        id="profile-avatar"
                        type="file"
                        name="avatar"
                        aria-label="Change photo"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={isPending}
                        onChange={(event) => {
                            const file = event.currentTarget.files?.[0];
                            if (!file) return;
                            if (file.size > ACCOUNT_AVATAR_MAX_BYTES) {
                                setMessage('Choose an image no larger than 512 KiB.');
                                return;
                            }
                            const data = new FormData();
                            data.set('avatar', file);
                            submit(() => saveAvatar(data), 'Photo saved.');
                            event.currentTarget.value = '';
                        }}
                    />
                    <Button
                        variant="secondary-danger"
                        disabled={isPending || !account.avatarUrl}
                        onClick={() => submit(deleteAvatar, 'Photo removed.')}
                    >
                        Remove photo
                    </Button>
                    <p>PNG, JPEG or WebP. Max 512 KiB.</p>
                </div>
            </div>
            <form
                noValidate
                onSubmit={form.onSubmit(
                    (values) => submit(() => saveProfile(values), 'Profile saved.'),
                    (_errors, _values, event) => focusFirstInvalid(event?.currentTarget),
                )}
            >
                <TextInput
                    shouldReserveMessage={false}
                    id="display-name"
                    label="Display name"
                    maxLength={DISPLAY_NAME_MAX_LENGTH}
                    required
                    disabled={isPending}
                    {...form.getInputProps('displayName')}
                />
                <TextInput
                    id="profile-email"
                    label="Email"
                    value={account.email}
                    readOnly
                    hint={`Managed through ${providerLabel}.`}
                />
                <TextInput
                    id="profile-language"
                    label="Language"
                    value="English"
                    readOnly
                    hint="Additional languages are planned for a future update."
                />
                <div className={styles.actions}>
                    <Button type="submit" loading={isPending}>
                        Save changes
                    </Button>
                </div>
            </form>
            <p className={styles.feedback} hidden={!message} role="status">
                {message}
            </p>
        </section>
    );
}
