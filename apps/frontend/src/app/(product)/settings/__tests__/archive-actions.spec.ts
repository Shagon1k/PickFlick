import { ApiError } from '#lib/api.server';

import { prepareArchiveDownload, readArchive, requestArchive } from '../archive-actions';

const api = vi.hoisted(() => ({
    requestDataExport: vi.fn(),
    getDataExport: vi.fn(),
    createDataExportLink: vi.fn(),
}));
vi.mock('#api/data-exports.server', () => api);

const ID = '10000000-0000-4000-8000-000000000031';

describe('archive actions', () => {
    beforeEach(() => vi.resetAllMocks());

    it('should reject extra identity selectors and malformed references before calling the API', async () => {
        expect(await requestArchive({ requestId: ID, userId: ID })).toMatchObject({ ok: false });
        expect(await readArchive('../another-account')).toMatchObject({ ok: false });
        expect(await prepareArchiveDownload({ id: ID, userId: ID })).toMatchObject({ ok: false });
        expect(api.requestDataExport).not.toHaveBeenCalled();
        expect(api.getDataExport).not.toHaveBeenCalled();
        expect(api.createDataExportLink).not.toHaveBeenCalled();
    });

    it('should preserve the request UUID across an uncertain API failure', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        api.requestDataExport
            .mockRejectedValueOnce(new ApiError(503))
            .mockResolvedValueOnce({ id: ID });
        expect(await requestArchive({ requestId: ID })).toMatchObject({ ok: false });
        expect(await requestArchive({ requestId: ID })).toEqual({ ok: true, data: { id: ID } });
        expect(api.requestDataExport).toHaveBeenNthCalledWith(1, { requestId: ID });
        expect(api.requestDataExport).toHaveBeenNthCalledWith(2, { requestId: ID });
        vi.restoreAllMocks();
    });

    it.each([
        [401, undefined, 'Your session has ended'],
        [404, undefined, 'unavailable or has expired'],
        [409, 'EXPORT_IN_PROGRESS', 'already being prepared'],
        [429, undefined, 'Try again in 10 minutes'],
    ])(
        'should explain API status %i without returning raw error data',
        async (status, reason, copy) => {
            api.requestDataExport.mockRejectedValueOnce(new ApiError(status, undefined, reason));
            expect(await requestArchive({ requestId: ID })).toMatchObject({
                ok: false,
                message: expect.stringContaining(copy),
            });
        },
    );
});
