'use client';

import { isAllowedAuthReturnTarget } from '@pickflick/contracts';
import { useRouter } from 'next/navigation';
import type { MouseEvent } from 'react';

import Icon from '#components/ui/Icon/Icon';

/**
 * Explicit form origins use the existing canonical return-path allowlist. Without one, previous
 * same-origin visits use history; direct visits and modified clicks keep the safe fallback.
 */
export default function BackLink({
    className,
    fallbackHref,
}: {
    className?: string | undefined;
    fallbackHref: string;
}) {
    const router = useRouter();
    function handleBackClick(event: MouseEvent<HTMLAnchorElement>): void {
        if (
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
        ) {
            return;
        }
        const returnTo = new URLSearchParams(window.location.search).get('returnTo');
        if (isAllowedAuthReturnTarget(returnTo)) {
            event.preventDefault();
            router.push(returnTo);
            return;
        }
        const referrer = document.referrer ? new URL(document.referrer) : null;
        if (window.history.length > 1 && referrer?.origin === window.location.origin) {
            event.preventDefault();
            window.history.back();
        }
    }

    return (
        <a className={className} href={fallbackHref} onClick={handleBackClick}>
            <Icon name="arrow-left" />
            Back
        </a>
    );
}
