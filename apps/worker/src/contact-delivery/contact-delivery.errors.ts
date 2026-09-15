export class ContactProviderError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super("Contact delivery provider request failed.");
    this.name = "ContactProviderError";
  }
}

export class ContactDeliveryClaimLostError extends Error {
  constructor() {
    super("Contact delivery claim is no longer owned by this worker.");
    this.name = "ContactDeliveryClaimLostError";
  }
}
