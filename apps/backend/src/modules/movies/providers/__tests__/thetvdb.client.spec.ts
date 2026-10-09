import { ThetvdbClient } from '../thetvdb.client.js';

describe('ThetvdbClient', () => {
    const request = vi.fn<typeof fetch>();
    const client = () =>
        new ThetvdbClient({ enabled: true, readToken: 'synthetic-only', timeoutMs: 1000 }, request);
    const ids = [{ source: 'imdb', externalId: 'tt0000100' }] as const;
    const movie = () => ({
        id: 10,
        remoteIds: [{ sourceName: 'IMDB', id: 'tt0000100' }],
        name: 'Русское название',
        translations: {
            nameTranslations: [{ language: 'eng', name: 'English title' }],
            overviewTranslations: [{ language: 'rus', overview: 'Русское описание' }],
        },
    });
    beforeEach(() => request.mockReset());
    it('should match by IMDb and confirm the extended record before using English translations', async () => {
        request.mockResolvedValueOnce(
            Response.json({ status: 'success', data: [{ movie: { id: 10 } }] }),
        );
        request.mockResolvedValueOnce(Response.json({ status: 'success', data: movie() }));
        const result = await client().details([...ids]);
        expect(result.externalIds).toContainEqual({ source: 'thetvdb', externalId: '10' });
        expect(result.data).toMatchObject({ title: 'English title', overview: null });
        expect(request.mock.calls[0]?.[0]).toEqual(
            new URL('https://api4.thetvdb.com/v4/search/remoteid/tt0000100'),
        );
        expect(request.mock.calls[1]?.[0]).toEqual(
            new URL('https://api4.thetvdb.com/v4/movies/10/extended?meta=translations'),
        );
    });
    it('should reject IMDb mismatch even when the title and year match', async () => {
        request.mockResolvedValueOnce(
            Response.json({ status: 'success', data: [{ movie: { id: 10 } }] }),
        );
        request.mockResolvedValueOnce(
            Response.json({
                status: 'success',
                data: { ...movie(), remoteIds: [{ sourceName: 'IMDB', id: 'tt9999999' }] },
            }),
        );
        await expect(client().details([...ids])).rejects.toMatchObject({
            reason: 'IDENTITY_CONFLICT',
        });
    });
    it('should refuse ambiguous remote-ID candidates', async () => {
        request.mockResolvedValue(
            Response.json({
                status: 'success',
                data: [{ movie: { id: 10 } }, { movie: { id: 11 } }],
            }),
        );
        await expect(client().details([...ids])).rejects.toMatchObject({
            reason: 'IDENTITY_CONFLICT',
        });
        expect(request).toHaveBeenCalledOnce();
    });
    it('should never search by title/year when mappings are missing', async () => {
        await expect(client().details([])).rejects.toMatchObject({ reason: 'MISSING_EXTERNAL_ID' });
        expect(request).not.toHaveBeenCalled();
    });
    it('should preserve not-found as a source-specific error', async () => {
        request.mockResolvedValue(new Response(null, { status: 404 }));
        await expect(
            client().details([{ source: 'thetvdb', externalId: '10' }]),
        ).rejects.toMatchObject({ reason: 'NOT_FOUND', source: 'thetvdb' });
    });
});
