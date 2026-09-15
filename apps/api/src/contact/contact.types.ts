import type { ContactSubmissionRequest } from "@pickflick/contracts";

export interface NormalizedContactSubmission extends ContactSubmissionRequest {
  readonly name?: string;
  readonly email?: string;
}

export interface AcceptContactMessageInput extends NormalizedContactSubmission {
  readonly id: string;
  readonly sourceHash: string;
  readonly contentHash: string;
}

export type ContactAcceptance =
  | { readonly kind: "accepted"; readonly id: string }
  | { readonly kind: "duplicate"; readonly id: string }
  | { readonly kind: "conflict" }
  | { readonly kind: "rate_limited" };
