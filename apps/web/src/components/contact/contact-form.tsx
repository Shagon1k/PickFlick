"use client";

import type { FormEvent } from "react";
import { useRef, useState } from "react";

import {
  CONTACT_EMAIL_MAX_LENGTH,
  CONTACT_MESSAGE_MAX_LENGTH,
  CONTACT_NAME_MAX_LENGTH,
  type ApiErrorEnvelope,
  type ContactSubmissionResponse,
} from "@pickflick/contracts";
import { Button, TextAreaField, TextField } from "@pickflick/ui";

import styles from "./contact.module.css";

interface FormValues {
  readonly message: string;
  readonly name: string;
  readonly email: string;
}

type FieldErrors = Partial<Record<keyof FormValues, string>>;
type FeedbackTone = "neutral" | "success" | "danger" | "warning";

const emptyValues: FormValues = { message: "", name: "", email: "" };

function validate(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  const message = values.message.trim();
  if (!message) {
    errors.message = "Enter a message.";
  } else if (values.message.length > CONTACT_MESSAGE_MAX_LENGTH) {
    errors.message = `Keep the message to ${CONTACT_MESSAGE_MAX_LENGTH} characters.`;
  }
  if (values.name.trim().length > CONTACT_NAME_MAX_LENGTH) {
    errors.name = `Keep your name to ${CONTACT_NAME_MAX_LENGTH} characters.`;
  }
  const email = values.email.trim();
  if (email.length > CONTACT_EMAIL_MAX_LENGTH || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    errors.email = "Enter a valid email address or leave this blank.";
  }
  return errors;
}

async function responseCode(response: Response): Promise<string | undefined> {
  try {
    const body = await response.json() as ApiErrorEnvelope | ContactSubmissionResponse;
    return "error" in body ? body.error.code : undefined;
  } catch {
    return undefined;
  }
}

export function ContactForm() {
  const [values, setValues] = useState<FormValues>(emptyValues);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; tone: FeedbackTone }>({ message: "", tone: "neutral" });
  const formRef = useRef<HTMLFormElement>(null);
  const attemptRef = useRef<{ signature: string; key: string } | undefined>(undefined);

  function update(field: keyof FormValues, value: string): void {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
    setFeedback({ message: "", tone: "neutral" });
  }

  function focusFirstError(): void {
    requestAnimationFrame(() => {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFeedback({ message: "Review the highlighted field and try again.", tone: "danger" });
      focusFirstError();
      return;
    }
    if (!navigator.onLine) {
      setFeedback({ message: "You appear to be offline. Reconnect, then send again; your message is still here.", tone: "warning" });
      return;
    }

    const payload = {
      message: values.message,
      ...(values.name.trim() ? { name: values.name } : {}),
      ...(values.email.trim() ? { email: values.email } : {}),
    };
    const signature = JSON.stringify(payload);
    if (!attemptRef.current || attemptRef.current.signature !== signature) {
      attemptRef.current = { signature, key: crypto.randomUUID() };
    }

    setPending(true);
    setFeedback({ message: "Sending your message…", tone: "neutral" });
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, submissionKey: attemptRef.current.key }),
      });
      if (response.ok) {
        const body = await response.json() as ContactSubmissionResponse;
        if (body.status !== "accepted" && body.status !== "duplicate") {
          throw new Error("Unexpected Contact response.");
        }
        setValues(emptyValues);
        setErrors({});
        attemptRef.current = undefined;
        setFeedback({ message: "Message received — we'll get back to you soon.", tone: "success" });
        return;
      }

      const code = await responseCode(response);
      if (response.status === 429 || code === "RATE_LIMITED") {
        setFeedback({ message: "Too many messages were sent from this connection. Try again in 10 minutes.", tone: "warning" });
      } else if (response.status === 409 || code === "CONFLICT") {
        attemptRef.current = undefined;
        setFeedback({ message: "This message changed after an earlier attempt. Review it, then send again.", tone: "warning" });
      } else if (response.status === 400 || code === "VALIDATION_FAILED") {
        setFeedback({ message: "The message could not be accepted. Review the fields and try again.", tone: "danger" });
        focusFirstError();
      } else {
        setFeedback({ message: "We couldn't save your message. Your text is still here — try again.", tone: "danger" });
      }
    } catch {
      setFeedback({ message: "We couldn't reach PickFlick. Your text is still here — try again.", tone: "danger" });
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={styles.form} noValidate onSubmit={submit} ref={formRef}>
      <TextAreaField
        {...(errors.message ? { error: errors.message } : {})}
        hint={`${values.message.length}/${CONTACT_MESSAGE_MAX_LENGTH} characters`}
        id="contact-message"
        label="Message — required"
        maxLength={CONTACT_MESSAGE_MAX_LENGTH}
        name="message"
        disabled={pending}
        onChange={(event) => update("message", event.currentTarget.value)}
        placeholder="Tell us what's on your mind…"
        required
        value={values.message}
      />
      <TextField
        autoComplete="name"
        {...(errors.name ? { error: errors.name } : {})}
        hint="Optional"
        id="contact-name"
        label="Your name"
        maxLength={CONTACT_NAME_MAX_LENGTH}
        name="name"
        disabled={pending}
        onChange={(event) => update("name", event.currentTarget.value)}
        placeholder="e.g. Jane Doe"
        value={values.name}
      />
      <TextField
        autoComplete="email"
        {...(errors.email ? { error: errors.email } : {})}
        hint="Optional"
        id="contact-email"
        label="Your email"
        maxLength={CONTACT_EMAIL_MAX_LENGTH}
        name="email"
        disabled={pending}
        onChange={(event) => update("email", event.currentTarget.value)}
        placeholder="e.g. jane@example.com"
        type="email"
        value={values.email}
      />

      <div className={styles.submitZone}>
        <Button
          className={styles.submitButton}
          disabled={feedback.tone === "success"}
          loading={pending}
          type="submit"
        >
          {feedback.tone === "success" ? "Message sent" : "Send message"}
        </Button>
        <p
          aria-atomic="true"
          aria-live="polite"
          className={styles.feedback}
          data-tone={feedback.tone}
          role="status"
          tabIndex={-1}
        >
          {feedback.message}
        </p>
      </div>
    </form>
  );
}
