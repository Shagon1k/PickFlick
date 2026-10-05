import { Writable } from 'node:stream';

import { pino } from 'pino';

import { HTTP_LOG_REDACTIONS } from '../app.module.js';

describe('HTTP log redaction', () => {
    it('should remove invitation URLs from requests, referrers, and redirect locations', () => {
        let output = '';
        const stream = new Writable({
            write(chunk: Buffer, _encoding, callback) {
                output += chunk.toString();
                callback();
            },
        });
        const logger = pino({ redact: HTTP_LOG_REDACTIONS }, stream);
        const invitation = '/invite/club/synthetic-private-invitation';
        logger.info({
            req: {
                method: 'POST',
                url: `/login?returnTo=${invitation}`,
                headers: {
                    referer: `https://example.invalid${invitation}`,
                    cookie: 'synthetic-cookie',
                    authorization: 'synthetic-authorization',
                },
            },
            res: {
                statusCode: 302,
                headers: { location: invitation, 'set-cookie': 'synthetic-cookie' },
            },
        });
        expect(output).not.toContain(invitation);
        expect(output).not.toContain('synthetic-cookie');
        expect(output).not.toContain('synthetic-authorization');
        expect(output).toContain('POST');
        expect(output).toContain('302');
    });
});
