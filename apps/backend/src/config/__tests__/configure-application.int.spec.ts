import { type ITestApi, startTestApi } from '../../testing/integration.js';

describe('configureApplication', () => {
    let api: ITestApi;

    beforeAll(async () => {
        api = await startTestApi();
    });

    afterAll(async () => {
        await api.close();
    });

    it('should send the API security headers and hide the framework', async () => {
        const response = await api.request('/health/live');

        expect(response.headers.get('content-security-policy')).toBe(
            "default-src 'none'; frame-ancestors 'none'",
        );
        expect(response.headers.get('x-content-type-options')).toBe('nosniff');
        expect(response.headers.get('referrer-policy')).toBe('no-referrer');
        expect(response.headers.get('strict-transport-security')).toBe('max-age=31536000');
        expect(response.headers.get('x-powered-by')).toBeNull();
    });
});
