import { authClient } from "./auth-client";

export async function startGoogleSignIn(returnTo: string): Promise<boolean> {
  const result = await authClient.signIn.social({
    provider: "google",
    callbackURL: returnTo,
  });

  return !result.error;
}
