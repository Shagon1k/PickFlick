export function withinCacheAge(fetchedAt: Date | string, hours: number): boolean {
    const age = Date.now() - new Date(fetchedAt).getTime();
    return age >= 0 && age < hours * 3600000;
}
