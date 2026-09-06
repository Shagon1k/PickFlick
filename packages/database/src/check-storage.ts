import { createHash, createHmac } from "node:crypto";

import type { WorkerEnvironment } from "@pickflick/config/environment";

interface StorageCheckOptions {
  readonly fetch?: typeof fetch;
  readonly now?: Date;
  readonly timeoutMilliseconds?: number;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function bucketUrl(configuration: WorkerEnvironment["s3"]): URL {
  const target = new URL(configuration.endpoint);
  if (configuration.forcePathStyle) {
    target.pathname = `${target.pathname.replace(/\/+$/, "")}/${configuration.bucket}`;
  } else {
    target.hostname = `${configuration.bucket}.${target.hostname}`;
  }
  return target;
}

function authorizationHeaders(configuration: WorkerEnvironment["s3"], target: URL, now: Date): Headers {
  const timestamp = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = timestamp.slice(0, 8);
  const payloadHash = sha256("");
  const canonicalHeaders = `host:${target.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${timestamp}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = ["HEAD", target.pathname, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credentialScope = `${date}/${configuration.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", timestamp, credentialScope, sha256(canonicalRequest)].join("\n");
  const dateKey = hmac(`AWS4${configuration.secretAccessKey}`, date);
  const regionKey = hmac(dateKey, configuration.region);
  const serviceKey = hmac(regionKey, "s3");
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = hmac(signingKey, stringToSign).toString("hex");

  return new Headers({
    authorization:
      `AWS4-HMAC-SHA256 Credential=${configuration.accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": timestamp,
  });
}

export async function checkStorage(
  configuration: WorkerEnvironment["s3"],
  options: StorageCheckOptions = {},
): Promise<void> {
  const target = bucketUrl(configuration);
  const signal = AbortSignal.timeout(options.timeoutMilliseconds ?? 5_000);

  let response: Response;
  try {
    response = await (options.fetch ?? fetch)(target, {
      method: "HEAD",
      headers: authorizationHeaders(configuration, target, options.now ?? new Date()),
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw new Error("Object storage check timed out.", { cause: error });
    throw error;
  }

  if (!response.ok) {
    throw new Error(`Object storage bucket check failed with HTTP ${response.status}.`);
  }
}
