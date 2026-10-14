import { getSessionState } from '@/api/session.server';
import SystemState from '@/components/shells/SystemState/SystemState';

export default async function NotFound() {
    // An unavailable session API still yields a usable public 404; it only picks the frame.
    const isSignedIn = (await getSessionState()) === 'authenticated';
    return <SystemState signedIn={isSignedIn} variant="not-found" />;
}
