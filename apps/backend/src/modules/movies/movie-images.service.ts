import { createHash } from 'node:crypto';

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { movieImageUrlSchema, type TMovieMetadata } from '@pickflick/contracts';

import { detectImageType, type TImageType } from '../../common/image-type.js';
import { StorageService } from '../storage/storage.service.js';
import { readBoundedBody } from './providers/movie-http.js';

const MAX_BYTES = 5 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 5000;

function requireImageType(body: Buffer): TImageType {
    const type = detectImageType(body);
    if (!type) throw new Error('Invalid catalog image');
    return type;
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
        return {
            ...movie,
            posterUrl: await this.store(movie.posterUrl),
            backdropUrl: null,
            cast: movie.cast?.map((person) => ({ ...person, profileUrl: null })) ?? movie.cast,
        };
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
                signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
            });
            if (!response.ok || !response.body) throw new Error('Catalog image unavailable');
            body = await readBoundedBody(response, MAX_BYTES);
            contentType = requireImageType(body);
        } catch {
            this.logger.warn({ event: 'movies.image.unavailable', key });
            return null;
        }
        await this.storage.put(objectKey, body, contentType);
        return `/api/movies/images/${key}`;
    }
}
