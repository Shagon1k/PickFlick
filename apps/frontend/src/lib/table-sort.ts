/**
 * The sort a header click asks for: ascending, then descending, then back to the default order
 * (undefined). Clicking another header while a sort is active also returns to the default, as
 * DESIGN.md specifies.
 */
export function getNextTableSort<TSort extends string>(
    current: { sort: TSort; direction?: 'asc' | 'desc' },
    sort: TSort,
): { sort: TSort; direction: 'asc' | 'desc' } | undefined {
    if (!current.direction) return { sort, direction: 'asc' };
    if (current.sort !== sort || current.direction === 'desc') return undefined;
    return { sort, direction: 'desc' };
}
