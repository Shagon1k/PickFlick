import { Module } from '@nestjs/common';
import type { TRuntimeEnvironment } from '@pickflick/config/environment';

import { RUNTIME_ENVIRONMENT } from '../../config/runtime.module.js';
import { MoviesRepository } from './movies.repository.js';
import { MoviesService } from './movies.service.js';
import { CompositeMovieProvider } from './providers/composite.provider.js';
import { MOVIE_PROVIDER } from './providers/movie-provider.js';
import { PoiskkinoClient } from './providers/poiskkino.client.js';
import { ThetvdbClient } from './providers/thetvdb.client.js';
import { TmdbClient } from './providers/tmdb.client.js';

@Module({
    providers: [
        {
            provide: MOVIE_PROVIDER,
            inject: [RUNTIME_ENVIRONMENT, MoviesRepository],
            useFactory: (
                { tmdb, catalog, poiskkino, thetvdb }: TRuntimeEnvironment,
                repository: MoviesRepository,
            ) =>
                catalog.provider === 'tmdb'
                    ? new TmdbClient(tmdb)
                    : new CompositeMovieProvider(
                          new PoiskkinoClient(poiskkino),
                          new ThetvdbClient(thetvdb),
                          catalog,
                          repository,
                      ),
        },
        MoviesRepository,
        MoviesService,
    ],
    exports: [MoviesService],
})
export class MoviesModule {}
