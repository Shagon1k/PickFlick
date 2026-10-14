import { createPrivateKey, sign } from 'node:crypto';

import type { TRuntimeEnvironment } from '@pickflick/config/environment';

const APPLE_AUDIENCE = 'https://appleid.apple.com';
// Apple accepts client secrets for up to six months; every API start signs a fresh one.
const CLIENT_SECRET_LIFETIME_SECONDS = 150 * 24 * 60 * 60;

function encodeJson(value: Record<string, string | number>): string {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function createAppleClientSecret(
    auth: Extract<TRuntimeEnvironment['auth'], { appleSignInEnabled: true }>,
    now: Date = new Date(),
): string {
    const issuedAt = Math.floor(now.getTime() / 1_000);
    const header = encodeJson({ alg: 'ES256', kid: auth.appleKeyId, typ: 'JWT' });
    const payload = encodeJson({
        aud: APPLE_AUDIENCE,
        exp: issuedAt + CLIENT_SECRET_LIFETIME_SECONDS,
        iat: issuedAt,
        iss: auth.appleTeamId,
        sub: auth.appleClientId,
    });
    const signingInput = `${header}.${payload}`;
    const privateKey = createPrivateKey(auth.applePrivateKey.replaceAll('\\n', '\n'));
    const signature = sign('sha256', Buffer.from(signingInput), {
        dsaEncoding: 'ieee-p1363',
        key: privateKey,
    });

    return `${signingInput}.${signature.toString('base64url')}`;
}
