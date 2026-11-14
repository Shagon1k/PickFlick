import { Module } from '@nestjs/common';

import { LibraryController } from './library.controller.js';
import { LibraryService } from './library.service.js';
import { PersonalRatingController } from './personal-rating/personal-rating.controller.js';
import { PersonalRatingService } from './personal-rating/personal-rating.service.js';
import { RatingsCsvController } from './ratings-csv/ratings-csv.controller.js';
import { RatingsCsvService } from './ratings-csv/ratings-csv.service.js';
import { WatchlistController } from './watchlist/watchlist.controller.js';
import { WatchlistService } from './watchlist/watchlist.service.js';

/** My Library: the Library views plus the Personal Ratings and Watchlist they list. */
@Module({
    controllers: [
        LibraryController,
        PersonalRatingController,
        WatchlistController,
        RatingsCsvController,
    ],
    providers: [LibraryService, PersonalRatingService, WatchlistService, RatingsCsvService],
})
export class LibraryModule {}
