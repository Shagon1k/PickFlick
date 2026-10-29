import 'server-only';

import type {
    IClubHub,
    IClubSettings,
    IClubSummary,
    TChangeMemberRoleRequest,
    TClubRatings,
    TClubRatingsQuery,
    TCreateClubRequest,
    TUpdateClubSettingsRequest,
} from '@pickflick/contracts';
import { cache } from 'react';

import { apiPath, requestApi } from '#lib/api.server';

export const listClubs = (): Promise<IClubSummary[]> => requestApi('/clubs');

export const getClubHub = cache(
    (clubId: string, incomingHeaders?: Headers): Promise<IClubHub> =>
        requestApi(apiPath`/clubs/${clubId}/hub`, {}, incomingHeaders),
);

export const getClubRatings = (clubId: string, query: TClubRatingsQuery): Promise<TClubRatings> => {
    const path = apiPath`/clubs/${clubId}/ratings`;
    return requestApi(
        `${path}?${new URLSearchParams({ sort: query.sort, page: String(query.page) })}`,
    );
};

export const createClub = (input: TCreateClubRequest): Promise<IClubSummary> =>
    requestApi('/clubs', { method: 'POST', json: input });

export const getClubSettings = (clubId: string): Promise<IClubSettings> =>
    requestApi(apiPath`/clubs/${clubId}/settings`);

export const updateClubSettings = (
    clubId: string,
    input: TUpdateClubSettingsRequest,
): Promise<IClubSettings> =>
    requestApi(apiPath`/clubs/${clubId}/settings`, { method: 'PATCH', json: input });

export const changeMemberRole = (
    clubId: string,
    membershipId: string,
    input: TChangeMemberRoleRequest,
): Promise<void> =>
    requestApi(apiPath`/clubs/${clubId}/members/${membershipId}/role`, {
        method: 'PATCH',
        json: input,
    });

export const CLUB_LIFECYCLE_ACTIONS = ['archive', 'reactivate', 'leave', 'delete'] as const;
export type TClubLifecycleAction = (typeof CLUB_LIFECYCLE_ACTIONS)[number];

export const changeClubLifecycle = (
    clubId: string,
    action: TClubLifecycleAction,
    confirmation: string,
): Promise<void> =>
    requestApi(apiPath`/clubs/${clubId}/${action}`, {
        method: 'POST',
        json: action === 'reactivate' ? {} : { confirmation },
    });

export const replaceClubAvatar = async (clubId: string, file: File): Promise<void> =>
    requestApi(apiPath`/clubs/${clubId}/avatar`, {
        method: 'PUT',
        body: await file.arrayBuffer(),
        contentType: file.type,
    });

export const removeClubAvatar = (clubId: string): Promise<void> =>
    requestApi(apiPath`/clubs/${clubId}/avatar`, { method: 'DELETE' });

export const removeClubMember = (
    clubId: string,
    membershipId: string,
    confirmation: string,
): Promise<void> =>
    requestApi(apiPath`/clubs/${clubId}/members/${membershipId}/remove`, {
        method: 'POST',
        json: { confirmation },
    });
