import { z } from 'zod';

import { movieImagePathSchema, tmdbIdSchema } from './movie.schema.js';

const text = z.string().max(1000);
const releaseDate = z.union([z.iso.date(), z.literal('')]).transform((value) => value || null);

export const tmdbMovieSchema = z.object({
    id: tmdbIdSchema,
    title: text.min(1),
    original_title: text.min(1),
    overview: z.string().max(20_000),
    release_date: releaseDate,
    adult: z.boolean(),
    original_language: z.string().max(10),
    poster_path: movieImagePathSchema,
    backdrop_path: movieImagePathSchema,
    vote_average: z.number().min(0).max(10),
    vote_count: z.number().int().nonnegative(),
});
export type TTmdbMovie = z.infer<typeof tmdbMovieSchema>;

export const tmdbSearchSchema = z.object({
    page: z.number().int().positive(),
    total_pages: z.number().int().nonnegative(),
    total_results: z.number().int().nonnegative(),
    results: z.array(tmdbMovieSchema).max(100),
});

export const tmdbDetailsSchema = tmdbMovieSchema.extend({
    runtime: z.number().int().nonnegative().nullable(),
    genres: z.array(z.object({ id: tmdbIdSchema, name: text })).max(100),
    imdb_id: z
        .string()
        .regex(/^tt\d{7,12}$/u)
        .nullable()
        .or(z.literal('')),
    credits: z.object({
        cast: z
            .array(
                z.object({
                    id: tmdbIdSchema,
                    name: text,
                    character: text,
                    profile_path: movieImagePathSchema,
                    order: z.number().int().nonnegative(),
                }),
            )
            .max(5000),
        crew: z.array(z.object({ id: tmdbIdSchema, name: text, job: text })).max(5000),
    }),
    videos: z.object({
        results: z
            .array(
                z.object({ key: text, name: text, site: text, type: text, official: z.boolean() }),
            )
            .max(1000),
    }),
});
