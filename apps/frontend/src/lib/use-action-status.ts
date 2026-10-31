'use client';

import { useState, useTransition } from 'react';

import { getOfflineMessage } from '#lib/offline';

const UNREACHABLE_MESSAGE = 'We could not reach PickFlick. Try again.';

interface IRunOptions<TResult> {
    /** Status shown while the request runs. */
    pendingMessage?: string;
    /** Status when the request never got an answer, such as a dropped connection. */
    unreachableMessage?: string;
    /** Receives the action's result, or a failure carrying `unreachableMessage`. */
    onResult: (result: TResult | { ok: false; message: string }) => void;
}

/**
 * The status line of a server-action mutation: it refuses to send while offline, shows progress
 * while the request runs and turns a lost request into copy. `onResult` decides everything else.
 * A message set with `announceSuccess` is for assistive technology only: render it with
 * `visually-hidden` while `isSuccess` is true.
 */
export function useActionStatus() {
    const [status, setStatus] = useState({ message: '', isSuccess: false });
    const setMessage = (message: string) => setStatus({ message, isSuccess: false });
    const announceSuccess = (message: string) => setStatus({ message, isSuccess: true });
    const [isPending, startTransition] = useTransition();
    function run<TResult>(
        request: () => Promise<TResult>,
        {
            pendingMessage = '',
            unreachableMessage = UNREACHABLE_MESSAGE,
            onResult,
        }: IRunOptions<TResult>,
    ) {
        const offlineMessage = getOfflineMessage();
        if (offlineMessage) {
            setMessage(offlineMessage);
            return;
        }
        setMessage(pendingMessage);
        startTransition(async () => {
            const result = await request().catch(() => ({
                ok: false as const,
                message: unreachableMessage,
            }));
            onResult(result);
        });
    }
    return { ...status, setMessage, announceSuccess, isPending, run };
}
