const safeErrorMessages: Readonly<Record<string, string>> = {
  access_denied: "Sign-in was cancelled. You can try again when you are ready.",
  account_not_linked: "This email is already connected to another sign-in method.",
  apple_email_not_verified: "Apple must share a verified email before you can create a PickFlick account.",
  authentication_failed: "Sign-in could not be completed safely. Please try again.",
  email_not_found: "Your sign-in provider must share a verified email before you can create a PickFlick account.",
  google_email_not_verified: "Google must verify your email before you can use it with PickFlick.",
  state_mismatch: "That sign-in request expired or was already used. Please start again.",
  state_not_found: "That sign-in request expired or was already used. Please start again.",
};

const defaultErrorMessage = "Sign-in could not be completed safely. Please try again.";

export function resolveLoginErrorMessage(errorCode: string | undefined): string | undefined {
  return errorCode ? (safeErrorMessages[errorCode] ?? defaultErrorMessage) : undefined;
}
