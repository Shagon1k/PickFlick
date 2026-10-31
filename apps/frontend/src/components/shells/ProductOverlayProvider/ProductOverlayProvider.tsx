'use client';

import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react';

import {
    type ICloseOverlayOptions,
    ProductOverlayContext,
    type TProductOverlay,
} from '#components/shells/product-overlay';

interface IProductOverlayProviderProps {
    children: ReactNode;
}

export default function ProductOverlayProvider({ children }: IProductOverlayProviderProps) {
    const [activeOverlay, setActiveOverlay] = useState<TProductOverlay | null>(null);
    const returnFocusRef = useRef<HTMLElement | null>(null);

    const closeOverlay = useCallback(({ shouldReturnFocus = true }: ICloseOverlayOptions = {}) => {
        const returnTarget = returnFocusRef.current;
        setActiveOverlay(null);
        if (shouldReturnFocus) {
            requestAnimationFrame(() => returnTarget?.focus());
        }
    }, []);

    const toggleOverlay = useCallback((overlay: TProductOverlay, trigger: HTMLElement) => {
        returnFocusRef.current = trigger;
        setActiveOverlay((current) => (current === overlay ? null : overlay));
    }, []);

    const value = useMemo(
        () => ({ activeOverlay, closeOverlay, toggleOverlay }),
        [activeOverlay, closeOverlay, toggleOverlay],
    );

    return <ProductOverlayContext value={value}>{children}</ProductOverlayContext>;
}
