import { createHash } from 'node:crypto';

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { movieImageUrlSchema, type TMovieMetadata } from '@pickflick/contracts';

import { StorageService } from '../storage/storage.service.js';

const MAX_BYTES = 5 * 1024 * 1024;

function imageType(body: Buffer): string {
    if (body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
        return 'image/png';
    if (body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) return 'image/jpeg';
    if (
        body.subarray(0, 4).toString('ascii') === 'RIFF' &&
        body.subarray(8, 12).toString('ascii') === 'WEBP'
    )
        return 'image/webp';
    throw new Error('Invalid catalog image');
}

@Injectable()
export class MovieImagesService {
    private readonly logger = new Logger(MovieImagesService.name);
    constructor(private readonly storage: StorageService) {}

    async get(key: string) {
        const image = await this.storage.get(`movie-images/${key}`);
        if (!image) throw new NotFoundException();
        return image;
    }

    async storeMedia<
        TMovie extends Pick<TMovieMetadata, 'posterUrl' | 'backdropUrl'> &
            Partial<Pick<TMovieMetadata, 'cast'>>,
    >(movie: TMovie): Promise<TMovie> {
        const [posterUrl, backdropUrl, cast] = await Promise.all([
            this.store(movie.posterUrl),
            this.store(movie.backdropUrl),
            movie.cast
                ? Promise.all(
                      movie.cast.map(async (person) => ({
                          ...person,
                          profileUrl: await this.store(person.profileUrl),
                      })),
                  )
                : movie.cast,
        ]);
        return { ...movie, posterUrl, backdropUrl, cast };
    }

    private async store(url: string | null): Promise<string | null> {
        if (!url) return null;
        const key = createHash('sha256').update(url).digest('hex');
        const objectKey = `movie-images/${key}`;
        if (await this.storage.get(objectKey)) return `/api/movies/images/${key}`;
        let body: Buffer;
        let contentType: string;
        try {
            movieImageUrlSchema.parse(url);
            // Never follow a provider redirect to an unvalidated host or private network.
            const response = await fetch(url, {
                redirect: 'error',
                signal: AbortSignal.timeout(5000),
            });
            if (!response.ok || !response.body) throw new Error('Catalog image unavailable');
            const reader = response.body.getReader();
            const chunks: Uint8Array[] = [];
            let size = 0;
            try {
                while (true) {
                    const chunk = await reader.read();
                    if (chunk.done) break;
                    const value: unknown = chunk.value;
                    if (!(value instanceof Uint8Array)) throw new Error('Invalid image body');
                    size += value.length;
                    if (size > MAX_BYTES) throw new Error('Catalog image exceeds size limit');
                    chunks.push(value);
                }
            } finally {
                await reader.cancel();
            }
            body = Buffer.concat(chunks);
            contentType = imageType(body);
        } catch {
            this.logger.warn({ event: 'movies.image.unavailable', key });
            return null;
        }
        await this.storage.put(objectKey, body, contentType);
        return `/api/movies/images/${key}`;
    }
}
