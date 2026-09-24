import { headers } from "next/headers";

import { hasAuthenticatedSession } from "../auth-server";
import { SystemState } from "../components/system-state/system-state";

export default async function NotFound() {
  const signedIn = await hasAuthenticatedSession(await headers());
  return <SystemState signedIn={signedIn} variant="not-found" />;
}
