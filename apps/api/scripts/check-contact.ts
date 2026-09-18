import { randomUUID } from "node:crypto";

import { loadRuntimeEnvironment } from "@pickflick/config/environment";

import {
  ContactConflictError,
  ContactRateLimitError,
  ContactValidationError,
} from "../src/contact/contact.errors.js";
import { PrismaContactMessageRepository } from "../src/contact/contact.repository.js";
import { ContactService } from "../src/contact/contact.service.js";
import { DatabaseService } from "../src/database/database.service.js";

const environment = loadRuntimeEnvironment();
if (environment.appEnvironment !== "local" && environment.appEnvironment !== "test") {
  throw new Error("The Contact integration check may run only against local or test data.");
}

const databaseService = new DatabaseService(environment);
const repository = new PrismaContactMessageRepository(databaseService);
const database = databaseService.client;
const createdIds: string[] = [];
const source = `contact-integration-${randomUUID()}`;

try {
  const attempts = Array.from({ length: 6 }, (_, index) => ({
    submissionKey: randomUUID(),
    message: `Synthetic Contact integration message ${index + 1}.`,
  }));
  const results = await Promise.allSettled(attempts.map((attempt) => new ContactService(repository, environment).submit(attempt, source)));
  const accepted = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  const rateLimited = results.filter(
    (result) => result.status === "rejected" && result.reason instanceof ContactRateLimitError,
  );
  createdIds.push(...accepted.map(({ id }) => id));
  if (accepted.length !== 5 || rateLimited.length !== 1) {
    throw new Error("Concurrent Contact submissions did not enforce the five-per-window limit.");
  }

  const acceptedIndex = results.findIndex((result) => result.status === "fulfilled");
  const acceptedAttempt = attempts[acceptedIndex];
  const acceptedResult = accepted[0];
  if (!acceptedAttempt || !acceptedResult) {
    throw new Error("Contact integration check did not produce an accepted message.");
  }
  const service = new ContactService(repository, environment);
  const duplicate = await service.submit(acceptedAttempt, source);
  if (duplicate.status !== "duplicate" || duplicate.id !== acceptedResult.id) {
    throw new Error("A repeated Contact submission did not resolve to its original record.");
  }

  try {
    await service.submit({ ...acceptedAttempt, message: "Changed content." }, source);
    throw new Error("A changed payload reused an existing Contact submission key.");
  } catch (error) {
    if (!(error instanceof ContactConflictError)) {
      throw error;
    }
  }

  try {
    await service.submit({ submissionKey: randomUUID(), message: "x".repeat(501) }, `${source}-invalid`);
    throw new Error("An oversized Contact message passed server validation.");
  } catch (error) {
    if (!(error instanceof ContactValidationError)) {
      throw error;
    }
  }

  console.log("Contact integration checks passed: validation, serialized rate limit, duplicate retry, and conflict handling.");
} finally {
  if (createdIds.length > 0) {
    await database.contactMessage.deleteMany({ where: { id: { in: createdIds } } });
  }
  await databaseService.onModuleDestroy();
}
