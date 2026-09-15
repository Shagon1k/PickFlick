"use client";

import { useEffect } from "react";

import { SystemState } from "../components/system-state/system-state";

export default function ApplicationError({
  retry,
}: Readonly<{
  error: Error & { digest?: string };
  retry: () => void;
}>) {
  useEffect(() => {
    globalThis.document.getElementById("system-state-title")?.focus();
  }, []);

  return <SystemState onRetry={retry} variant="application-error" />;
}
