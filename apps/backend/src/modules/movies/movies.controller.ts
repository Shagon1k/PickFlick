import {
    Body,
    Controller,
    Get,
    Header,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Res,
    StreamableFile,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
    movieIdSchema,
    movieSearchSchema,
    movieStoredImageKeySchema,
    type TMovieSearch,
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
    @Header('Cache-Control', 'private, no-store')
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

    @Post('search')
    @HttpCode(HttpStatus.OK)
    @Header('Cache-Control', 'private, no-store')
    @Throttle(CATALOG_RATE_LIMIT)
    async search(@Body(new ZodValidationPipe(movieSearchSchema)) input: TMovieSearch) {
        const result = await this.movies.search(input, true);
        if (result.state === 'unavailable') return result;
        return {
            ...result,
            data: {
                ...result.data,
                movies: result.data.movies.map((movie) => ({
                    ...movie,
                    posterUrl: null,
                    backdropUrl: null,
                })),
            },
        };
    }
}
