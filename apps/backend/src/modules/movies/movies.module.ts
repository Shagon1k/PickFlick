import { Module } from '@nestjs/common';
import type { TRuntimeEnvironment } from '@pickflick/config/environment';

import { RUNTIME_ENVIRONMENT } from '../../config/runtime.module.js';
import { MovieImagesService } from './movie-images.service.js';
import { MoviesController } from './movies.controller.js';
import { MoviesRepository } from './movies.repository.js';
import { MoviesService } from './movies.service.js';
import { PersonalRatingController } from './personal-rating.controller.js';
import { PersonalRatingService } from './personal-rating.service.js';
import { CompositeMovieProvider } from './providers/composite.provider.js';
import { MOVIE_PROVIDER } from './providers/movie-provider.js';
import { PoiskkinoClient } from './providers/poiskkino.client.js';
import { ThetvdbClient } from './providers/thetvdb.client.js';
import { TmdbClient } from './providers/tmdb.client.js';

@Module({
    controllers: [MoviesController, PersonalRatingController],
    providers: [
        {
            provide: MOVIE_PROVIDER,
            inject: [RUNTIME_ENVIRONMENT],
            useFactory: ({ tmdb, catalog, poiskkino, thetvdb }: TRuntimeEnvironment) =>
                catalog.provider === 'tmdb'
                    ? new TmdbClient(tmdb)
                    : new CompositeMovieProvider(
                          new PoiskkinoClient(poiskkino),
                          new ThetvdbClient(thetvdb),
                      ),
        },
        PersonalRatingService,
        MoviesRepository,
        MovieImagesService,
        MoviesService,
    ],
    exports: [MoviesService],
})
export class MoviesModule {}
