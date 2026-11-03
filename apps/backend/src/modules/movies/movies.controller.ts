import {
    Body,
    Controller,
    Get,
    Header,
    HttpCode,
    HttpStatus,
    NotFoundException,
    Param,
    Post,
    Res,
    StreamableFile,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
    getPosterPath,
    getYouTubeVideoId,
    movieIdSchema,
    movieSearchSchema,
    movieStoredImageKeySchema,
    type TMovieSearch,
    youtubeVideoIdSchema,
} from '@pickflick/contracts';
import type { Response } from 'express';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { MovieImagesService } from './movie-images.service.js';
import { MoviesService } from './movies.service.js';

// Catalog reads reach paid providers: sixty a minute per client.
const CATALOG_RATE_LIMIT = { default: { ttl: 60_000, limit: 60 } };

@Controller('movies')
export class MoviesController {
    constructor(
        private readonly movies: MoviesService,
        private readonly images: MovieImagesService,
    ) {}

    @Get('images/:key')
    @Header('Cache-Control', 'private, max-age=86400')
    async getImage(
        @Param('key', new ZodValidationPipe(movieStoredImageKeySchema)) key: string,
        @Res({ passthrough: true }) response: Response,
    ): Promise<StreamableFile> {
        const image = await this.images.get(key);
        response.setHeader('Content-Type', image.contentType);
        return new StreamableFile(image.body);
    }

    @Get(':movieId')
    @Throttle(CATALOG_RATE_LIMIT)
    async getDetails(@Param('movieId', new ZodValidationPipe(movieIdSchema)) movieId: string) {
        const response = await this.movies.getDetailsResponse(movieId);
        const { result } = response;
        if (result.state === 'unavailable') return response;
        return {
            ...response,
            result: { ...result, data: await this.images.storeMedia(result.data) },
        };
    }

    @Get(':movieId/poster')
    async getPoster(
        @Param('movieId', new ZodValidationPipe(movieIdSchema)) movieId: string,
        @Res() response: Response,
    ): Promise<void> {
        const posterUrl = await this.movies.getCachedPoster(movieId);
        if (!posterUrl) throw new NotFoundException();
        const stored = await this.images.storeMedia({ posterUrl, backdropUrl: null });
        if (!stored.posterUrl) throw new NotFoundException();
        // The target is named by a content hash, so the redirect may be cached like the image.
        response.set('Cache-Control', 'private, max-age=86400');
        response.redirect(stored.posterUrl);
    }

    @Get(':movieId/trailers/:videoId/thumbnail')
    async getTrailerThumbnail(
        @Param('movieId', new ZodValidationPipe(movieIdSchema)) movieId: string,
        @Param('videoId', new ZodValidationPipe(youtubeVideoIdSchema)) videoId: string,
        @Res() response: Response,
    ): Promise<void> {
        const movies = await this.movies.getCachedMetadata([movieId]);
        const knownTrailer = movies
            .get(movieId)
            ?.trailers?.some((trailer) => getYouTubeVideoId(trailer.url) === videoId);
        if (!knownTrailer) throw new NotFoundException();
        const thumbnail = await this.images.storeTrailerThumbnail(videoId);
        if (!thumbnail) throw new NotFoundException();
        response.set('Cache-Control', 'private, max-age=86400');
        response.redirect(thumbnail);
    }

    @Post('search')
    @HttpCode(HttpStatus.OK)
    @Throttle(CATALOG_RATE_LIMIT)
    async search(@Body(new ZodValidationPipe(movieSearchSchema)) input: TMovieSearch) {
        const result = await this.movies.search(input, { allowStale: true });
        if (result.state === 'unavailable') return result;
        const metadata = await this.movies.getCachedMetadata(
            result.data.movies.filter((movie) => !movie.genres?.length).map((movie) => movie.id),
        );
        return {
            ...result,
            data: {
                ...result.data,
                movies: result.data.movies.map((movie) => ({
                    ...movie,
                    genres: movie.genres?.length
                        ? movie.genres
                        : (metadata.get(movie.id)?.genres ?? null),
                    posterUrl: movie.posterUrl ? getPosterPath(movie.id) : null,
                    backdropUrl: null,
                })),
            },
        };
    }
}
