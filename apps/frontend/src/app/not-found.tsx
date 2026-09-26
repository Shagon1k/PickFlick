import { getSessionState } from '@/api/session.server';
import { SystemState } from '@/components/SystemState/SystemState';

export default async function NotFound() {
    // An unavailable session API still yields a usable public 404; it only picks the frame.
    const signedIn = (await getSessionState()) === 'authenticated';
    return <SystemState signedIn={signedIn} variant="not-found" />;
}
