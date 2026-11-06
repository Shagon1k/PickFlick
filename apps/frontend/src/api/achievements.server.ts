import 'server-only';

import type { TAchievements } from '@pickflick/contracts';

import { apiPath, requestApi } from '#lib/api.server';

export const getPersonalAchievements = () => requestApi<TAchievements>('/library/achievements');

export const getClubAchievements = (clubId: string) =>
    requestApi<TAchievements>(apiPath`/clubs/${clubId}/achievements`);
