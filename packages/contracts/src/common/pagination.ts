import { z } from 'zod';

/** The page fields every paginated list returns next to its items. */
export function createPaginationSchema<TPageSize extends number>(pageSize: TPageSize) {
    return z.object({
        page: z.number().int().positive(),
        pages: z.number().int().positive(),
        pageSize: z.literal(pageSize),
        total: z.number().int().nonnegative(),
    });
}
