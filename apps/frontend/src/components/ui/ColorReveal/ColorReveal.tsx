'use client';

import clsx from 'clsx';
import { type ReactNode, useEffect, useRef } from 'react';

import styles from './ColorReveal.module.scss';
import { COLOR_REVEAL_CONFIG } from './color-reveal.config';

const MILLISECONDS_PER_SECOND = 1000;
const TOUCH_HOLD_MS = 1800;
const MASK_START_PX = 0.1;
const EMPTY_MASK = 'linear-gradient(transparent, transparent)';
const FULL_MASK = 'linear-gradient(black, black)';

function toMilliseconds(value: string) {
    return Number.parseFloat(value) * (value.trim().endsWith('ms') ? 1 : MILLISECONDS_PER_SECOND);
}

/** Image/accent children are visual only; surfaces leave their host's live content untouched. */
export default function ColorReveal({
    children,
    shouldFill = false,
    variant = 'image',
}: {
    children?: ReactNode;
    shouldFill?: boolean;
    variant?: 'image' | 'accent' | 'surface' | 'outline';
}) {
    const ref = useRef<HTMLSpanElement>(null);
    const colorRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if (!ref.current || !colorRef.current) return;
        const surface = ref.current;
        const color = colorRef.current;
        const scope = surface.closest<HTMLElement>('[data-color-reveal-surface]');
        if (variant === 'outline' || (scope && variant !== 'surface')) return;
        const trigger = surface.closest<HTMLElement>('[data-color-reveal-trigger]') ?? surface;
        const area = variant === 'surface' ? trigger : surface;
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        let frame = 0;
        let timeout = 0;
        const masks = new Map<HTMLElement, { mask: string; composite: string }>();
        let hasKeyboardFocus = false;

        function stop() {
            window.cancelAnimationFrame(frame);
            window.clearTimeout(timeout);
        }

        function fade() {
            if (!COLOR_REVEAL_CONFIG.enabled || reducedMotion.matches) {
                showStandardState(false);
                return;
            }
            stop();
            masks.clear();
            for (const layer of getLayers()) {
                layer.style.transition = 'opacity var(--motion-color-reveal) var(--ease-standard)';
                layer.style.opacity = '0';
            }
        }

        function getLayers() {
            return variant === 'surface'
                ? Array.from(trigger.querySelectorAll<HTMLElement>('[data-color-reveal-layer]'))
                : [color];
        }

        function showStandardState(isRevealing: boolean) {
            stop();
            masks.clear();
            for (const layer of getLayers()) {
                layer.style.maskImage = 'none';
                layer.style.maskComposite = 'add';
                layer.style.transition = reducedMotion.matches
                    ? 'none'
                    : 'opacity var(--motion-local) var(--ease-standard)';
                layer.style.opacity = isRevealing ? '1' : '0';
            }
        }

        function animateColor(isRevealing: boolean, event?: PointerEvent) {
            if (!COLOR_REVEAL_CONFIG.enabled || reducedMotion.matches) {
                showStandardState(isRevealing);
                return;
            }
            stop();
            const box = area.getBoundingClientRect();
            const originX = event
                ? Math.max(0, Math.min(box.width, event.clientX - box.left))
                : box.width / 2;
            const originY = event
                ? Math.max(0, Math.min(box.height, event.clientY - box.top))
                : box.height / 2;
            const radius = Math.max(
                Math.hypot(originX, originY),
                Math.hypot(box.width - originX, originY),
                Math.hypot(originX, box.height - originY),
                Math.hypot(box.width - originX, box.height - originY),
            );
            const tokens = window.getComputedStyle(surface);
            const duration = toMilliseconds(tokens.getPropertyValue('--motion-color-reveal'));
            const feather =
                radius * Number.parseFloat(tokens.getPropertyValue('--color-reveal-feather'));
            const layers = getLayers().map((layer) => {
                const bounds = layer.getBoundingClientRect();
                const previous = masks.get(layer) ?? { mask: EMPTY_MASK, composite: 'add' };
                layer.style.transition = 'none';
                layer.style.opacity = '1';
                return { layer, previous, left: bounds.left - box.left, top: bounds.top - box.top };
            });
            // Freeze an interrupted mask so changing direction never fills or clears the image at once.
            const start = performance.now();
            function draw(now: number) {
                const time = Math.min(1, (now - start) / duration);
                const progress = 1 - (1 - time) ** 2;
                const coverage = isRevealing ? progress : 1 - progress;
                const edge = coverage * (radius + feather * 2) - feather;
                for (const { layer, previous, left, top } of layers) {
                    const front = `radial-gradient(circle at ${originX - left}px ${originY - top}px, black ${Math.max(0, edge - feather)}px, transparent ${Math.max(MASK_START_PX, edge + feather)}px)`;
                    const mask =
                        time < 1
                            ? `${front}, ${previous.mask}`
                            : isRevealing
                              ? FULL_MASK
                              : EMPTY_MASK;
                    const composite =
                        time < 1
                            ? `${isRevealing ? 'add' : 'intersect'}, ${previous.composite}`
                            : 'add';
                    masks.set(layer, { mask, composite });
                    layer.style.maskImage = mask;
                    layer.style.maskComposite = composite;
                }
                if (time < 1) frame = window.requestAnimationFrame(draw);
            }
            draw(start);
            frame = window.requestAnimationFrame(draw);
        }

        function handlePointerEnter(event: PointerEvent) {
            if (event.pointerType === 'mouse' || event.pointerType === 'pen')
                animateColor(true, event);
        }

        function handlePointerLeave(event: PointerEvent) {
            if (event.pointerType !== 'touch') animateColor(false, event);
        }

        function handlePointerDown(event: PointerEvent) {
            if (event.pointerType !== 'touch' || !event.isPrimary) return;
            animateColor(true, event);
            timeout = window.setTimeout(fade, TOUCH_HOLD_MS);
        }

        function handleFocusIn(event: FocusEvent) {
            hasKeyboardFocus =
                event.target instanceof Element && event.target.matches(':focus-visible');
            if (hasKeyboardFocus) animateColor(true);
        }

        function handleFocusOut(event: FocusEvent) {
            if (!hasKeyboardFocus) return;
            if (!(event.relatedTarget instanceof Node) || !trigger.contains(event.relatedTarget)) {
                hasKeyboardFocus = false;
                fade();
            }
        }

        trigger.addEventListener('pointerenter', handlePointerEnter);
        trigger.addEventListener('pointerleave', handlePointerLeave);
        trigger.addEventListener('pointerdown', handlePointerDown, { passive: true });
        trigger.addEventListener('pointercancel', fade);
        trigger.addEventListener('focusin', handleFocusIn);
        trigger.addEventListener('focusout', handleFocusOut);
        reducedMotion.addEventListener('change', fade);
        return () => {
            stop();
            trigger.removeEventListener('pointerenter', handlePointerEnter);
            trigger.removeEventListener('pointerleave', handlePointerLeave);
            trigger.removeEventListener('pointerdown', handlePointerDown);
            trigger.removeEventListener('pointercancel', fade);
            trigger.removeEventListener('focusin', handleFocusIn);
            trigger.removeEventListener('focusout', handleFocusOut);
            reducedMotion.removeEventListener('change', fade);
        };
    }, [variant]);

    return (
        <span
            className={clsx(styles.reveal, styles[`m-${variant}`])}
            data-fill={shouldFill || undefined}
            ref={ref}
        >
            {variant === 'image' || variant === 'accent' ? (
                <span className={styles.reveal__base}>{children}</span>
            ) : null}
            <span
                aria-hidden="true"
                className={styles.reveal__color}
                data-color-reveal-layer
                ref={colorRef}
            >
                {variant === 'image' || variant === 'accent' ? children : null}
            </span>
        </span>
    );
}
