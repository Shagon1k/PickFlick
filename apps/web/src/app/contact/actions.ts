"use server";

import { headers } from "next/headers";

import type { ContactSubmissionRequest } from "@pickflick/contracts";

import { contactValues, validateContactValues } from "../../components/contact/contact-form.validation";
import type { ContactFieldName } from "../../components/contact/contact-form.types";
import { submitContactRequest } from "../../components/contact/contact-submission";
import type { FormActionState } from "../../components/forms/form-action.types";

function result(
  previous: FormActionState<ContactFieldName>,
  state: Omit<FormActionState<ContactFieldName>, "revision">,
): FormActionState<ContactFieldName> {
  return { ...state, revision: previous.revision + 1 };
}

export async function submitContact(
  previous: FormActionState<ContactFieldName>,
  formData: FormData,
): Promise<FormActionState<ContactFieldName>> {
  const values = contactValues(formData);
  const fieldErrors = validateContactValues(values);
  if (Object.keys(fieldErrors).length > 0) {
    return result(previous, {
      status: "error",
      message: "Review the highlighted field and try again.",
      tone: "danger",
      fieldErrors,
    });
  }

  const submissionKey = formData.get("submissionKey");
  if (typeof submissionKey !== "string") {
    return result(previous, {
      status: "error",
      message: "We couldn't save your message. Your text is still here — try again.",
      tone: "danger",
    });
  }

  const payload: ContactSubmissionRequest = {
    submissionKey,
    message: values.message,
    ...(values.name.trim() ? { name: values.name } : {}),
    ...(values.email.trim() ? { email: values.email } : {}),
  };
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.slice(0, 1_000);
  const backendUrl = new URL(process.env.BACKEND_INTERNAL_URL ?? "http://127.0.0.1:3001");
  const response = await submitContactRequest(payload, {
    endpoint: new URL("/contact", backendUrl),
    ...(forwardedFor ? { forwardedFor } : {}),
  });

  if (response.ok) {
    return result(previous, {
      status: "success",
      message: "Message received — we'll get back to you soon.",
      tone: "success",
    });
  }
  if (response.status === 429 || response.code === "RATE_LIMITED") {
    return result(previous, {
      status: "error",
      message: "Too many messages were sent from this connection. Try again in 10 minutes.",
      tone: "warning",
    });
  }
  if (response.status === 409 || response.code === "CONFLICT") {
    return result(previous, {
      status: "error",
      message: "This message changed after an earlier attempt. Review it, then send again.",
      tone: "warning",
    });
  }
  return result(previous, {
    status: "error",
    message: "We couldn't save your message. Your text is still here — try again.",
    tone: "danger",
  });
}
