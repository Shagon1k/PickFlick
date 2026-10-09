import { Module } from '@nestjs/common';
import type { TRuntimeEnvironment } from '@pickflick/config/environment';

import { RUNTIME_ENVIRONMENT } from '../../config/runtime.module.js';
import { MOVIE_PROVIDER } from './movie-provider.js';
import { MoviesRepository } from './movies.repository.js';
import { MoviesService } from './movies.service.js';
import { TmdbClient } from './tmdb.client.js';

@Module({
    providers: [
        {
            provide: MOVIE_PROVIDER,
            inject: [RUNTIME_ENVIRONMENT],
            useFactory: ({ tmdb }: TRuntimeEnvironment) => new TmdbClient(tmdb),
        },
        MoviesRepository,
        MoviesService,
    ],
    exports: [MoviesService],
})
export class MoviesModule {}
