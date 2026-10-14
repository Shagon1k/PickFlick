'use client';

import type { MouseEvent } from 'react';

import Icon from '#components/ui/Icon/Icon';

/**
 * Returns to the previous PickFlick page. Direct visits, external referrers, and modified clicks
 * follow `fallbackHref` instead, so the link never leaves the app or dead-ends.
 */
export default function BackLink({
    className,
    fallbackHref,
}: {
    className?: string | undefined;
    fallbackHref: string;
}) {
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
