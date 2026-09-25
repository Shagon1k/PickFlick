import { headers } from "next/headers";

import { probeSession } from "../auth-server";
import { SystemState } from "../components/system-state/system-state";

export default async function NotFound() {
  // An unavailable session API still yields a usable public 404; it only picks the frame.
  const signedIn = (await probeSession(await headers())) === "authenticated";
  return <SystemState signedIn={signedIn} variant="not-found" />;
}
