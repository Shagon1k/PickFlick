import { Body, Controller, Get, Header, HttpCode, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { movieIdSchema, movieSearchSchema, type TMovieSearch } from '@pickflick/contracts';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { MoviesService } from './movies.service.js';

@Controller('movies')
export class MoviesController {
    constructor(private readonly movies: MoviesService) {}

    @Get(':movieId')
    @Header('Cache-Control', 'private, no-store')
    @Throttle({ default: { ttl: 60_000, limit: 60 } })
    details(@Param('movieId', new ZodValidationPipe(movieIdSchema)) movieId: string) {
        return this.movies.detailsResponse(movieId);
    }

    @Post('search')
    @HttpCode(200)
    @Header('Cache-Control', 'private, no-store')
    @Throttle({ default: { ttl: 60_000, limit: 60 } })
    search(@Body(new ZodValidationPipe(movieSearchSchema)) input: TMovieSearch) {
        return this.movies.search(input, true);
    }
}
