"use client";

import { useState } from "react";

import { Button } from "@pickflick/ui";

import { authClient } from "./auth-client";
import styles from "./login.module.css";

interface LoginActionsProps {
  readonly returnTo: string;
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32l3.57 2.76a12 12 0 0 0 3.27-8.09Z" />
      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76A6.95 6.95 0 0 1 12 19.14c-3.15 0-5.82-2.13-6.77-5L1.53 17A11.04 11.04 0 0 0 12 23Z" />
      <path fill="currentColor" d="M5.23 14.14a7.12 7.12 0 0 1 0-4.28L1.53 7A11.04 11.04 0 0 0 1 12c0 1.78.42 3.46 1.22 4.99l3.7-2.86Z" />
      <path fill="currentColor" d="M12 4.86c1.6 0 3.04.55 4.17 1.63l3.12-3.12A11.04 11.04 0 0 0 12 1C8.1 1 4.68 2.83 2.53 5.7l3.7 2.86A7.13 7.13 0 0 1 12 4.86Z" />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path fill="currentColor" d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09ZM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25Z" />
    </svg>
  );
}

export function LoginActions({ returnTo }: LoginActionsProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function signInWithGoogle() {
    setPending(true);
    setError("");
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: returnTo,
      });
      if (result.error) {
        setError("Google sign-in could not be started. Please try again.");
        setPending(false);
      }
    } catch {
      setError("Google sign-in could not be started. Please try again.");
      setPending(false);
    }
  }

  return (
    <div className={styles.actionArea}>
      <div className={styles.oauthStack}>
        <Button className={styles.oauthButton} loading={pending} onClick={signInWithGoogle} variant="secondary">
          <span className={styles.oauthIcon}><GoogleMark /></span>
          Continue with Google
        </Button>
        <Button aria-describedby="apple-availability" className={styles.oauthButton} disabled variant="secondary">
          <span className={`${styles.oauthIcon} ${styles.appleIcon}`}><AppleMark /></span>
          Continue with Apple
        </Button>
      </div>
      <p className={styles.availability} id="apple-availability">Apple sign-in is coming next.</p>
      <p aria-live="polite" className={styles.feedback} data-visible={Boolean(error)} role="status">{error}</p>
    </div>
  );
}
