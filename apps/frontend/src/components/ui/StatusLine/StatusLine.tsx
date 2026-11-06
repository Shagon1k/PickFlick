export interface IStatusLineProps {
    message: string;
    /** A success is announced to assistive technology only; the change itself is the feedback. */
    isSuccess?: boolean;
    className?: string;
}

/** The live status line under a form: progress and failures stay visible. */
export default function StatusLine({ message, isSuccess = false, className }: IStatusLineProps) {
    return (
        <p
            aria-atomic="true"
            aria-live="polite"
            className={isSuccess ? 'visually-hidden' : className}
            role="status"
        >
            {message}
        </p>
    );
}
