"use client";

import { useState } from "react";

import { Button, Icon } from "@pickflick/ui";

import { startGoogleSignIn } from "./auth.service";
import styles from "./login.module.css";

interface LoginActionsProps {
  readonly returnTo: string;
}

export function LoginActions({ returnTo }: LoginActionsProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function signInWithGoogle() {
    setPending(true);
    setError("");
    try {
      if (!await startGoogleSignIn(returnTo)) {
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
          <span className={styles.oauthIcon}><Icon name="google" /></span>
          Continue with Google
        </Button>
        <Button aria-describedby="apple-availability" className={styles.oauthButton} disabled variant="secondary">
          <span className={`${styles.oauthIcon} ${styles.appleIcon}`}><Icon name="apple" /></span>
          Continue with Apple
        </Button>
      </div>
      <p className={styles.availability} id="apple-availability">Apple sign-in is coming next.</p>
      <p aria-live="polite" className={styles.feedback} data-visible={Boolean(error)} role="status">{error}</p>
    </div>
  );
}
