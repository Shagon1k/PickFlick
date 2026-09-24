"use client";

import { useEffect } from "react";

import { authClient } from "../components/auth/auth-client";
import { SystemState } from "../components/system-state/system-state";

export default function ApplicationError({
  retry,
}: Readonly<{
  error: Error & { digest?: string };
  retry: () => void;
}>) {
  // Until the session resolves, the public recovery chrome stays safe even when the API is down.
  const { data: session } = authClient.useSession();
  const signedIn = Boolean(session?.user);

  useEffect(() => {
    globalThis.document.getElementById("system-state-title")?.focus({ preventScroll: true });
  }, [signedIn]);

  return <SystemState onRetry={retry} signedIn={signedIn} variant="application-error" />;
}
