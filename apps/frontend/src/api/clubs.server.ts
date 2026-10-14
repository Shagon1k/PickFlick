import 'server-only';

import type {
    IClubHub,
    IClubSettings,
    IClubSummary,
    TChangeMemberRoleRequest,
    TCreateClubRequest,
    TUpdateClubSettingsRequest,
} from '@pickflick/contracts';

import { apiPath, requestApi } from '@/lib/api.server';

export const listClubs = (): Promise<IClubSummary[]> => requestApi('/clubs');

export const getClubHub = (clubId: string, incomingHeaders?: Headers): Promise<IClubHub> =>
    requestApi(apiPath`/clubs/${clubId}/hub`, {}, incomingHeaders);

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

export type TClubLifecycleAction = 'archive' | 'reactivate' | 'leave' | 'delete';

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
