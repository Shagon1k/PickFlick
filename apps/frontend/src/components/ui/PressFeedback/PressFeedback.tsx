'use client';

import { useEffect } from 'react';

const CHECK_SELECTOR = 'input[type="checkbox"], input[type="radio"]';
const CONTROL_SELECTOR = `button, summary, [role="button"], [role="menuitem"], a[data-press-feedback], ${CHECK_SELECTOR}`;
const MILLISECONDS_PER_SECOND = 1000;

function getControl(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof Element)) return null;
    const control = target.closest<HTMLElement>(CONTROL_SELECTOR);
    if (control) return control;
    const input = target.closest('label')?.control;
    return input?.matches(CHECK_SELECTOR) ? input : null;
}

function getSurface(control: HTMLElement): HTMLElement {
    // Hidden inputs animate their visible sibling; composite buttons mark only their action icon.
    const sibling = control.nextElementSibling;
    if (sibling instanceof HTMLElement && sibling.hasAttribute('data-press-surface'))
        return sibling;
    return control.querySelector<HTMLElement>('[data-press-surface]') ?? control;
}

/** One press response for native controls, including those rendered inside portals. */
export default function PressFeedback() {
    useEffect(() => {
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        const running = new Map<HTMLElement, Animation>();

        function pulse(control: HTMLElement) {
            if (
                reducedMotion.matches ||
                control.matches(
                    ':disabled, [readonly], [aria-disabled="true"], [aria-busy="true"]',
                ) ||
                control.closest('[aria-readonly="true"], [inert]')
            )
                return;
            const surface = getSurface(control);
            const style = window.getComputedStyle(surface);
            // CSS optimization may serialize the 350ms token as .35s.
            const duration = style.getPropertyValue('--motion-action').trim();
            running.get(surface)?.cancel();
            // Individual scale preserves a control's existing translation or rotation.
            const animation = surface.animate(
                [
                    { scale: '1' },
                    {
                        scale: style.getPropertyValue('--action-scale').trim(),
                        offset: Number.parseFloat(style.getPropertyValue('--action-peak-offset')),
                    },
                    { scale: '1' },
                ],
                {
                    duration:
                        Number.parseFloat(duration) *
                        (duration.endsWith('ms') ? 1 : MILLISECONDS_PER_SECOND),
                    easing: style.getPropertyValue('--ease-action').trim(),
                },
            );
            running.set(surface, animation);
            const forget = () => {
                if (running.get(surface) === animation) running.delete(surface);
            };
            animation.onfinish = forget;
            animation.oncancel = forget;
        }

        function handlePointerDown(event: PointerEvent) {
            if (event.button !== 0 || !event.isPrimary) return;
            const control = getControl(event.target);
            if (control) pulse(control);
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.repeat || (event.key !== 'Enter' && event.key !== ' ')) return;
            const control = getControl(event.target);
            if (!control) return;
            if (event.key === ' ' && control.matches('a[href]')) return;
            if (event.key === 'Enter' && control.matches(CHECK_SELECTOR)) return;
            pulse(control);
        }

        function stopAnimations() {
            for (const animation of running.values()) animation.cancel();
            running.clear();
        }

        // Capture starts feedback before a React handler can navigate, submit or remove a control.
        document.addEventListener('pointerdown', handlePointerDown, {
            capture: true,
            passive: true,
        });
        document.addEventListener('keydown', handleKeyDown, true);
        reducedMotion.addEventListener('change', stopAnimations);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown, true);
            document.removeEventListener('keydown', handleKeyDown, true);
            reducedMotion.removeEventListener('change', stopAnimations);
            stopAnimations();
        };
    }, []);
    return null;
}
