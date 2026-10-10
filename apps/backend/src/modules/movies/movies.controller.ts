import { Body, Controller, Header, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { movieSearchSchema, type TMovieSearch } from '@pickflick/contracts';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { MoviesService } from './movies.service.js';

@Controller('movies')
export class MoviesController {
    constructor(private readonly movies: MoviesService) {}

    @Post('search')
    @HttpCode(200)
    @Header('Cache-Control', 'private, no-store')
    @Throttle({ default: { ttl: 60_000, limit: 60 } })
    search(@Body(new ZodValidationPipe(movieSearchSchema)) input: TMovieSearch) {
        return this.movies.search(input, true);
    }
}
