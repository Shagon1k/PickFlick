import 'server-only';

import type {
    IClubHub,
    IClubSettings,
    IClubSummary,
    TChangeMemberRoleRequest,
    TCreateClubRequest,
    TUpdateClubSettingsRequest,
} from '@pickflick/contracts';

import { apiRequest } from '@/lib/api.server';

export const listClubs = (): Promise<IClubSummary[]> => apiRequest('/clubs');

export const getClubHub = (clubId: string, incomingHeaders?: Headers): Promise<IClubHub> =>
    apiRequest(`/clubs/${clubId}/hub`, {}, incomingHeaders);

export const createClub = (input: TCreateClubRequest): Promise<IClubSummary> =>
    apiRequest('/clubs', { method: 'POST', json: input });

export const getClubSettings = (clubId: string): Promise<IClubSettings> =>
    apiRequest(`/clubs/${clubId}/settings`);

export const updateClubSettings = (
    clubId: string,
    input: TUpdateClubSettingsRequest,
): Promise<IClubSettings> =>
    apiRequest(`/clubs/${clubId}/settings`, { method: 'PATCH', json: input });

export const changeMemberRole = (
    clubId: string,
    membershipId: string,
    input: TChangeMemberRoleRequest,
): Promise<void> =>
    apiRequest(`/clubs/${clubId}/members/${membershipId}/role`, { method: 'PATCH', json: input });

export type TClubLifecycleAction = 'archive' | 'reactivate' | 'leave' | 'delete';

export const changeClubLifecycle = (
    clubId: string,
    action: TClubLifecycleAction,
    confirmation: string,
): Promise<void> =>
    apiRequest(`/clubs/${clubId}/${action}`, {
        method: 'POST',
        json: action === 'reactivate' ? {} : { confirmation },
    });

export const replaceClubAvatar = async (clubId: string, file: File): Promise<void> =>
    apiRequest(`/clubs/${clubId}/avatar`, {
        method: 'PUT',
        body: await file.arrayBuffer(),
        contentType: file.type,
    });

export const removeClubAvatar = (clubId: string): Promise<void> =>
    apiRequest(`/clubs/${clubId}/avatar`, { method: 'DELETE' });

export const removeClubMember = (
    clubId: string,
    membershipId: string,
    confirmation: string,
): Promise<void> =>
    apiRequest(`/clubs/${clubId}/members/${membershipId}/remove`, {
        method: 'POST',
        json: { confirmation },
    });
