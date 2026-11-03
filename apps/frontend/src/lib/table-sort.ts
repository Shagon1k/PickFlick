export function getNextTableSort<TSort extends string>(
    current: { sort: TSort; direction?: 'asc' | 'desc' },
    sort: TSort,
): { sort: TSort; direction: 'asc' | 'desc' } | undefined {
    if (!current.direction) return { sort, direction: 'asc' };
    if (current.sort !== sort || current.direction === 'desc') return undefined;
    return { sort, direction: 'desc' };
}
