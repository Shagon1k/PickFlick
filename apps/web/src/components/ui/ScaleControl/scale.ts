/** Club score scales are inclusive 0..N or 1..N ranges with N no greater than 10. */
export function createInclusiveScale(min: number, max: number): number[] {
    if (
        !Number.isInteger(min) ||
        !Number.isInteger(max) ||
        (min !== 0 && min !== 1) ||
        max < min ||
        max > 10
    ) {
        throw new RangeError(
            'Scale must be an inclusive 0..N or 1..N range with N no greater than 10.',
        );
    }
    return Array.from({ length: max - min + 1 }, (_, index) => min + index);
}
