import 'server-only';

import type { TMovieResult, TMovieSearch, TMovieSearchResults } from '@pickflick/contracts';

import { apiRequest } from '@/lib/api.server';

export const searchMovies = (input: TMovieSearch): Promise<TMovieResult<TMovieSearchResults>> =>
    apiRequest('/movies/search', { method: 'POST', json: input });
