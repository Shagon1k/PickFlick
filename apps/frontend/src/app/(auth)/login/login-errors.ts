const safeErrorMessages: Record<string, string> = {
    access_denied: 'Sign-in was cancelled. You can try again when you are ready.',
    account_not_linked: 'This email is already connected to another sign-in method.',
    apple_email_not_verified:
        'Apple must share a verified email before you can create a PickFlick account.',
    authentication_failed: 'Sign-in could not be completed safely. Please try again.',
    email_not_found:
        'Your sign-in provider must share a verified email before you can create a PickFlick account.',
    google_email_not_verified:
        'Google must verify your email before you can use it with PickFlick.',
    state_mismatch: 'That sign-in request expired or was already used. Please start again.',
    state_not_found: 'That sign-in request expired or was already used. Please start again.',
};

export const SESSION_UNAVAILABLE_MESSAGE =
    'We could not check your session right now. If you are already signed in, try again in a moment.';

const DEFAULT_ERROR_MESSAGE = 'Sign-in could not be completed safely. Please try again.';

export function resolveLoginErrorMessage(errorCode: string | undefined): string | undefined {
    return errorCode ? (safeErrorMessages[errorCode] ?? DEFAULT_ERROR_MESSAGE) : undefined;
}
