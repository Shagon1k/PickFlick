import { ApiError, apiPath, buildVisitorHeaders, requestApi } from '../api.server';

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

describe('apiPath', () => {
    it('should encode each interpolated value as one path segment', () => {
        expect(apiPath`/sessions/${'../clubs/x'}/roster`).toBe('/sessions/..%2Fclubs%2Fx/roster');
        expect(apiPath`/clubs/${'abc'}/members/${'def'}/remove`).toBe(
            '/clubs/abc/members/def/remove',
        );
    });
    it.each(['.', '..'])('should reject the dot segment %s', (segment) => {
        expect(() => apiPath`/sessions/${segment}/roster`).toThrow();
    });
});

describe('requestApi', () => {
    const fetchMock = vi.fn<typeof fetch>();
    beforeEach(() => vi.stubGlobal('fetch', fetchMock));
    afterEach(() => {
        fetchMock.mockReset();
        vi.unstubAllGlobals();
    });

    it('should send JSON as the visitor and parse the JSON answer', async () => {
        fetchMock.mockResolvedValue(Response.json({ id: 'club' }, { status: 201 }));

        const result = await requestApi<{ id: string }>(
            '/clubs',
            { method: 'POST', json: { name: 'Club' } },
            new Headers({ cookie: 'a=b' }),
        );

        expect(result).toEqual({ id: 'club' });
        const [url, init] = fetchMock.mock.calls[0]!;
        expect((url as URL).pathname).toBe('/clubs');
        expect(init).toMatchObject({ method: 'POST', body: '{"name":"Club"}', cache: 'no-store' });
        expect(Object.fromEntries(new Headers(init?.headers).entries())).toEqual({
            cookie: 'a=b',
            'content-type': 'application/json',
        });
    });

    it('should return nothing for an answer without a body', async () => {
        fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

        await expect(requestApi('/notifications/read', {}, new Headers())).resolves.toBeUndefined();
    });

    it('should throw the status, code and reason from the error envelope', async () => {
        fetchMock.mockResolvedValue(
            Response.json(
                { error: { code: 'CONFLICT', reason: 'SESSION_CHANGED' } },
                { status: 409 },
            ),
        );

        await expect(requestApi('/sessions/x', {}, new Headers())).rejects.toEqual(
            new ApiError(409, 'CONFLICT', 'SESSION_CHANGED'),
        );
    });
});
