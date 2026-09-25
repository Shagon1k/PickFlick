import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';

import { classes } from './utilities.js';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'secondary-danger' | 'danger';
type ButtonSize = 'default' | 'small';

function buttonState(success: unknown, loading: unknown): 'success' | 'loading' | undefined {
    if (success) {
        return 'success';
    }
    return loading ? 'loading' : undefined;
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    readonly variant?: ButtonVariant;
    readonly size?: ButtonSize;
    readonly loading?: boolean;
    readonly success?: string;
}

export function Button({
    children,
    className,
    disabled,
    loading = false,
    size = 'default',
    success,
    type = 'button',
    variant = 'primary',
    ...props
}: ButtonProps) {
    return (
        <>
            <button
                {...props}
                aria-busy={loading || undefined}
                className={classes(
                    'pf-button',
                    `pf-button--${variant}`,
                    size === 'small' && 'pf-button--small',
                    className,
                )}
                data-state={buttonState(success, loading)}
                disabled={disabled || loading}
                type={type}
            >
                {loading ? <span aria-hidden="true" className="pf-spinner" /> : null}
                <span className="pf-button__label">{children}</span>
            </button>
            {success ? (
                <span
                    aria-atomic="true"
                    aria-live="polite"
                    className="pf-visually-hidden"
                    role="status"
                >
                    {success}
                </span>
            ) : null}
        </>
    );
}

export interface ActionLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
    readonly variant?: Exclude<ButtonVariant, 'danger'>;
    readonly size?: ButtonSize;
    readonly disabled?: boolean;
}

export function ActionLink({
    children,
    className,
    disabled = false,
    href,
    onClick,
    size = 'default',
    tabIndex,
    variant = 'secondary',
    ...props
}: ActionLinkProps) {
    return (
        <a
            {...props}
            aria-disabled={disabled || undefined}
            className={classes(
                'pf-button',
                `pf-button--${variant}`,
                size === 'small' && 'pf-button--small',
                className,
            )}
            href={disabled ? undefined : href}
            onClick={
                disabled
                    ? (event) => {
                          event.preventDefault();
                      }
                    : onClick
            }
            tabIndex={disabled ? -1 : tabIndex}
        >
            <span className="pf-button__label">{children}</span>
        </a>
    );
}
