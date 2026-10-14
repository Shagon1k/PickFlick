import { buildVisitorHeaders } from '../api.server';

describe('buildVisitorHeaders', () => {
    it('should forward the session cookie and both client address headers only', () => {
        const incoming = new Headers({
            cookie: 'pickflick.session_token=abc',
            'cf-connecting-ip': '198.51.100.7',
            'x-forwarded-for': '198.51.100.7, 10.0.0.2',
            authorization: 'Bearer leaked',
            host: 'pick-flick.app',
        });

        const outgoing = buildVisitorHeaders(incoming);

        expect(Object.fromEntries(outgoing.entries())).toEqual({
            cookie: 'pickflick.session_token=abc',
            'cf-connecting-ip': '198.51.100.7',
            'x-forwarded-for': '198.51.100.7, 10.0.0.2',
        });
    });

    it('should omit headers the visitor did not send', () => {
        expect([...buildVisitorHeaders(new Headers({ cookie: 'a=b' })).keys()]).toEqual(['cookie']);
    });
});
