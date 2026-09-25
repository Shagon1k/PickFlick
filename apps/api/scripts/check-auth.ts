import { checkAppAuthorization } from './auth-check/app-authorization.js';
import { checkAppleIdentity } from './auth-check/apple-identity.js';
import { checkConcurrentSuspension } from './auth-check/concurrent-suspension.js';
import { checkGoogleIdentity } from './auth-check/google-identity.js';
import { cleanUpAuthCheck } from './auth-check/harness.js';
import { checkIdentityLinking } from './auth-check/identity-linking.js';
import { checkSessionLifecycle } from './auth-check/sessions.js';
import { checkSignInBoundary } from './auth-check/sign-in-boundary.js';

try {
    const { userId } = await checkSessionLifecycle();
    const { adminPrincipal } = await checkAppAuthorization();
    await checkSignInBoundary();
    const googleIdentity = await checkGoogleIdentity(userId);
    await checkAppleIdentity(adminPrincipal);
    await checkIdentityLinking(googleIdentity);
    await checkConcurrentSuspension(googleIdentity.registeredUser, adminPrincipal);

    console.log(
        'Authentication checks passed: new/returning Google and Apple identity, rate-limited single-row Apple POST handoff with expiry cleanup, pre-resolution protected-auth abuse limits, bounded first-return and relay fields, filtered account listings, fixed provider permissions and link parameters, callback-bound fresh-session linking, duplicate/conflict denial, serialized last-provider protection, no provider credential retention, origin/return rejection, state/nonce/PKCE, atomic state consumption, expiry/replay/denial intent safety, authoritative role/status resolution, rolling session cookies, forged/expired/revoked/suspended denial, suspended provider sign-in rejection, serialized concurrent session issuance and suspension, idempotent App role changes, transactional suspension and role-change revocation, database sessions, sign-out, and immediate revocation.',
    );
} finally {
    await cleanUpAuthCheck();
}
