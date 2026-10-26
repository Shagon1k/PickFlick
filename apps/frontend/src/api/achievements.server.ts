import 'server-only';

import type { TAchievements } from '@pickflick/contracts';

import { apiPath, requestApi } from '#lib/api.server';

export function getPersonalAchievements() {
    return requestApi<TAchievements>('/library/achievements');
}

export function getClubAchievements(clubId: string) {
    return requestApi<TAchievements>(apiPath`/clubs/${clubId}/achievements`);
}
