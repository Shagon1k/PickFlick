import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { resolveAuthReturnTarget } from "@pickflick/contracts";
import { BrandImage, SprocketDivider } from "@pickflick/ui";

import { isAppleSignInEnabled, probeSession } from "../../auth-server";
import { LoginActions } from "../../components/auth/login-actions";
import { resolveLoginErrorMessage, sessionUnavailableMessage } from "../../components/auth/login-errors";
import { firstSearchValue } from "../../components/auth/login.utils";
import styles from "../../components/auth/login.module.css";

export const metadata: Metadata = {
  title: "Sign in — PickFlick",
  description: "Sign in to PickFlick with an approved identity provider.",
};

export default async function LoginPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  await connection();
  const parameters = await searchParams;
  const returnTo = resolveAuthReturnTarget(firstSearchValue(parameters.returnTo));
  const session = await probeSession(await headers());
  if (session === "authenticated") {
    redirect(returnTo);
  }
  const appleSignInEnabled = isAppleSignInEnabled();
  // Sign-in stays available during a session-API outage; the notice explains a stale signed-in state.
  const errorMessage = resolveLoginErrorMessage(firstSearchValue(parameters.error)) ??
    (session === "unavailable" ? sessionUnavailableMessage : undefined);

  return (
    <main className={styles.page}>
      <a className={styles.backLink} href="/">
        <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
          <path d="M19 12H5m7 7-7-7 7-7" stroke="currentColor" strokeWidth="1.8" />
        </svg>
        Back
      </a>
      <section aria-labelledby="login-title" className={styles.scene}>
        <div aria-hidden="true" className={styles.spotlight} />
        <BrandImage alt="" asset="searchDiscovery" className={styles.mascot} loading="eager" />
        <div className={styles.card}>
          <h1 id="login-title">Welcome to PickFlick</h1>
          <p className={styles.lead}>Sign in to join your group&apos;s screening room.</p>
          {errorMessage ? <p className={styles.errorBanner} role="alert">{errorMessage}</p> : null}
          <LoginActions appleSignInEnabled={appleSignInEnabled} returnTo={returnTo} />
          <p className={styles.legal}>
            By continuing, you agree to PickFlick&apos;s <a href="/legal/terms">Terms of Service</a> and {" "}
            <a href="/legal/privacy">Privacy Notice</a>.
          </p>
        </div>
        <SprocketDivider />
        <p className={styles.ornament}>Scene 01 · The Arrival</p>
      </section>
    </main>
  );
}
