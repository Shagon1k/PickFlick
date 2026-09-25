'use client';

import { Button } from '@pickflick/ui';
import { useTransition } from 'react';

export default function ErrorRecoveryPreviewPage() {
    const [isPending, startTransition] = useTransition();

    function triggerFailure() {
        startTransition(() => {
            throw new Error(
                'Preview provider failure with a deliberately long diagnostic payload that must remain outside the rendered recovery boundary. '.repeat(
                    8,
                ),
            );
        });
    }

    return (
        <main className="scaffold-panel">
            <p className="scaffold-panel__eyebrow">Internal quality route</p>
            <h1>Error recovery preview</h1>
            <div className="scaffold-panel__body">
                <p>
                    Trigger a controlled provider-style failure to inspect the production
                    application boundary.
                </p>
                <Button loading={isPending} onClick={triggerFailure}>
                    Simulate provider failure
                </Button>
            </div>
        </main>
    );
}
