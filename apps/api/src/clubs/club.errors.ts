export class ClubAuthorizationError extends Error {
  override readonly name = "ClubAuthorizationError";
}

export class ClubConflictError extends Error {
  override readonly name = "ClubConflictError";
}

export class ClubValidationError extends Error {
  override readonly name = "ClubValidationError";
}
