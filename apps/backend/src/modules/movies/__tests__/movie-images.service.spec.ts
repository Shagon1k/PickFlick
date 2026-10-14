import { createHash } from 'node:crypto';

import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { buildCanonicalDetails } from '../../../testing/movie-fixtures.js';
import { StorageService } from '../../storage/storage.service.js';
import { MovieImagesService } from '../movie-images.service.js';

const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
);
const SOURCE_URL = 'https://image.tmdb.org/t/p/original/synthetic.jpg';
const key = createHash('sha256').update(SOURCE_URL).digest('hex');

describe('MovieImagesService', () => {
    const storage = { get: vi.fn<StorageService['get']>(), put: vi.fn<StorageService['put']>() };
    const request = vi.fn<typeof fetch>();
    let service: MovieImagesService;
    beforeEach(async () => {
        const module = await Test.createTestingModule({
            providers: [MovieImagesService, { provide: StorageService, useValue: storage }],
        }).compile();
        service = module.get(MovieImagesService);
        vi.resetAllMocks();
        vi.stubGlobal('fetch', request);
        storage.get.mockResolvedValue(null);
        storage.put.mockResolvedValue();
        request.mockImplementation(() =>
            Promise.resolve(new Response(png, { headers: { 'content-type': 'text/html' } })),
        );
    });
    afterEach(() => vi.unstubAllGlobals());

    it('should copy provider bytes to private storage and ingest only the displayed poster for a large cast', async () => {
        const result = await service.storeMedia({
            ...buildCanonicalDetails(),
            posterUrl: SOURCE_URL,
            backdropUrl: 'https://image.tmdb.org/t/p/original/backdrop.jpg',
            cast: Array.from({ length: 50 }, (_, index) => ({
                name: `Actor ${index}`,
                character: 'Lead',
                profileUrl: 'https://image.tmdb.org/t/p/original/portrait.jpg',
            })),
        });
        expect(result.posterUrl).toBe(`/api/movies/images/${key}`);
        expect(result.backdropUrl).toBeNull();
        expect(result.cast).toEqual(
            Array.from({ length: 50 }, (_, index) => ({
                name: `Actor ${index}`,
                character: 'Lead',
                profileUrl: null,
            })),
        );
        expect(request).toHaveBeenCalledTimes(1);
        expect(storage.get).toHaveBeenCalledTimes(1);
        expect(storage.put).toHaveBeenCalledTimes(1);
        expect(storage.put).toHaveBeenCalledWith(`movie-images/${key}`, png, 'image/png');
        expect(request).toHaveBeenCalledWith(SOURCE_URL, {
            redirect: 'error',
            signal: expect.any(AbortSignal),
        });
    });
    it('should reuse stored media without downloading again and serve the stored object', async () => {
        storage.get.mockResolvedValue({ body: png, contentType: 'image/png' });
        expect(
            (await service.storeMedia({ ...buildCanonicalDetails(), posterUrl: SOURCE_URL }))
                .posterUrl,
        ).toBe(`/api/movies/images/${key}`);
        expect(request).not.toHaveBeenCalled();
        expect(await service.get(key)).toEqual({ body: png, contentType: 'image/png' });
        expect(storage.get).toHaveBeenCalledWith(`movie-images/${key}`);
    });
    it.each(['https://evil.invalid/image.png', 'http://127.0.0.1/image.png'])(
        'should reject an unsafe image source %s before fetching',
        async (posterUrl) => {
            expect(
                (await service.storeMedia({ ...buildCanonicalDetails(), posterUrl })).posterUrl,
            ).toBeNull();
            expect(request).not.toHaveBeenCalled();
            expect(storage.put).not.toHaveBeenCalled();
        },
    );
    it.each([
        new Response('<svg/>'),
        new Response(Buffer.alloc(5 * 1024 * 1024 + 1)),
        new Response(null, { status: 302 }),
    ])(
        'should show missing media for invalid, oversized or redirected downloads %#',
        async (response) => {
            request.mockResolvedValue(response);
            expect(
                (await service.storeMedia({ ...buildCanonicalDetails(), posterUrl: SOURCE_URL }))
                    .posterUrl,
            ).toBeNull();
            expect(storage.put).not.toHaveBeenCalled();
        },
    );
    it('should preserve details when image transport fails and propagate storage failures', async () => {
        request.mockRejectedValue(new TypeError('download failed'));
        expect(
            (await service.storeMedia({ ...buildCanonicalDetails(), posterUrl: SOURCE_URL }))
                .posterUrl,
        ).toBeNull();
        request.mockResolvedValue(new Response(png));
        storage.put.mockRejectedValue(new Error('storage failed'));
        await expect(
            service.storeMedia({ ...buildCanonicalDetails(), posterUrl: SOURCE_URL }),
        ).rejects.toThrow('storage failed');
        await expect(service.get(key)).rejects.toBeInstanceOf(NotFoundException);
    });
});
