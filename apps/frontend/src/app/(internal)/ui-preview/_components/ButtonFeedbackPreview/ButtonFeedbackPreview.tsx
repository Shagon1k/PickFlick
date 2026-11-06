'use client';

import { useActionState } from 'react';

import Button from '#components/ui/Button/Button';

export default function ButtonFeedbackPreview() {
    const [message, save, isPending] = useActionState(
        async () => await Promise.resolve('Saved'),
        '',
    );
    return (
        <form action={save}>
            <Button loading={isPending} success={message} type="submit">
                Save example
            </Button>
        </form>
    );
}
