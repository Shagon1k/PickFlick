import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";

export interface CorrelationContext {
  readonly correlationId: string;
  readonly requestId?: string;
  readonly jobId?: string;
}

const correlationStorage = new AsyncLocalStorage<CorrelationContext>();
const externalCorrelationPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const jobIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function resolveCorrelationId(candidate?: string): string {
  const value = candidate?.trim();
  return value && externalCorrelationPattern.test(value) ? value : randomUUID();
}

function safeJobIdentifier(candidate: string): string {
  const value = candidate.trim();
  if (value && jobIdentifierPattern.test(value)) return value;
  return `job-${createHash("sha256").update(candidate).digest("hex").slice(0, 16)}`;
}

export function currentCorrelationContext(): CorrelationContext | undefined {
  return correlationStorage.getStore();
}

export function runWithRequestCorrelation<T>(candidate: string | undefined, operation: (requestId: string) => T): T {
  const requestId = resolveCorrelationId(candidate);
  return correlationStorage.run({ correlationId: requestId, requestId }, () => operation(requestId));
}

export function runWithJobCorrelation<T>(
  jobId: string,
  candidate: string | undefined,
  operation: (correlationId: string) => T,
): T {
  const correlationId = resolveCorrelationId(candidate);
  return correlationStorage.run(
    { correlationId, jobId: safeJobIdentifier(jobId) },
    () => operation(correlationId),
  );
}
