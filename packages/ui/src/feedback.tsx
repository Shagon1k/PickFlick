import type { ReactNode } from 'react';

import { classes, type FeedbackTone } from './utilities.js';

export interface AlertProps {
    readonly children: ReactNode;
    readonly title?: string;
    readonly tone?: FeedbackTone;
    readonly className?: string;
}

export function Alert({ children, className, title, tone = 'neutral' }: AlertProps) {
    return (
        <div
            aria-live={tone === 'danger' ? 'assertive' : 'polite'}
            className={classes('pf-alert', className)}
            data-tone={tone}
            role={tone === 'danger' ? 'alert' : 'status'}
        >
            <span aria-hidden="true" className="pf-alert__mark" />
            <span>
                {title ? <strong className="pf-alert__title">{title}</strong> : null}
                <span className="pf-alert__body">{children}</span>
            </span>
        </div>
    );
}

export interface StatusBannerProps {
    readonly children: ReactNode;
    readonly label?: string;
    readonly tone?: FeedbackTone;
}

/** Decorative film-sprocket rule that closes a cinematic scene. */
export function SprocketDivider({ className }: Readonly<{ className?: string | undefined }>) {
    return (
        <div aria-hidden="true" className={classes('pf-sprocket-divider', className)}>
            <i />
            <i />
            <i />
        </div>
    );
}

export function StatusBanner({
    children,
    label = 'Session status',
    tone = 'neutral',
}: StatusBannerProps) {
    return (
        <section aria-label={label} className="pf-status-banner" data-tone={tone}>
            <span aria-hidden="true" className="pf-status-banner__icon">
                i
            </span>
            <span>{children}</span>
        </section>
    );
}

export interface ProgressFilmStripProps {
    readonly label: string;
    readonly value: number;
    readonly max: number;
    readonly compact?: boolean;
}

export function ProgressFilmStrip({ compact = false, label, max, value }: ProgressFilmStripProps) {
    const safeMax = Math.max(1, max);
    const safeValue = Math.min(Math.max(0, value), safeMax);

    return (
        <div className="pf-progress" data-compact={compact || undefined}>
            <div className="pf-progress__copy">
                <span>{label}</span>
                <strong>
                    {safeValue}/{safeMax}
                </strong>
            </div>
            <progress aria-label={label} max={safeMax} value={safeValue} />
        </div>
    );
}

export interface EmptyStateProps {
    readonly title: string;
    readonly children: ReactNode;
    readonly action?: ReactNode;
}

export function EmptyState({ action, children, title }: EmptyStateProps) {
    return (
        <section className="pf-empty-state">
            <span aria-hidden="true" className="pf-sprocket">
                <i />
                <i />
                <i />
            </span>
            <h3>{title}</h3>
            <div>{children}</div>
            {action ? <div className="pf-empty-state__action">{action}</div> : null}
        </section>
    );
}

export interface LoadingStateProps {
    readonly label: string;
    readonly lines?: number;
}

export function LoadingState({ label, lines = 3 }: LoadingStateProps) {
    return (
        <div aria-live="polite" aria-busy="true" className="pf-loading-state" role="status">
            <span className="pf-visually-hidden">{label}</span>
            {Array.from({ length: Math.max(1, lines) }, (_, index) => (
                <span aria-hidden="true" className="pf-skeleton" key={index} />
            ))}
        </div>
    );
}

export interface PillProps {
    readonly children: ReactNode;
    readonly tone?: 'neutral' | 'warm' | 'success' | 'warning' | 'danger';
}

export function Pill({ children, tone = 'neutral' }: PillProps) {
    return (
        <span className="pf-pill" data-tone={tone}>
            {children}
        </span>
    );
}
