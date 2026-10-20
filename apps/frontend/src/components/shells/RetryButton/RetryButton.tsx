'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import Button from '#components/ui/Button/Button';

export default function RetryButton() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    return (
        <Button loading={isPending} onClick={() => startTransition(() => router.refresh())}>
            Try again
        </Button>
    );
}
