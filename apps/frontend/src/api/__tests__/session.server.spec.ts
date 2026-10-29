import { getSessionState } from '../session.server';

const incoming = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock('next/headers', () => ({ headers: () => Promise.resolve(incoming.headers) }));

describe('getSessionState', () => {
    const fetchMock = vi.fn<typeof fetch>();
    beforeEach(() => {
        incoming.headers = new Headers({ cookie: 'pickflick.session_token=abc' });
        vi.stubGlobal('fetch', fetchMock);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });
    afterEach(() => {
        fetchMock.mockReset();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('should be anonymous without asking the API when there is no cookie', async () => {
        incoming.headers = new Headers();

        expect(await getSessionState()).toBe('anonymous');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should follow the API answer for a cookie', async () => {
        fetchMock.mockResolvedValueOnce(Response.json({ user: { id: 'user' } }));
        fetchMock.mockResolvedValueOnce(Response.json(null));

        expect(await getSessionState()).toBe('authenticated');
        expect(await getSessionState()).toBe('anonymous');
    });

    // Treating an outage as signed out would send every visitor to the login page.
    it('should be unavailable, not anonymous, when the API fails or times out', async () => {
        fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));
        fetchMock.mockRejectedValueOnce(new DOMException('Timed out', 'TimeoutError'));

        expect(await getSessionState()).toBe('unavailable');
        expect(await getSessionState()).toBe('unavailable');
    });
});
