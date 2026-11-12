import 'server-only';

import type { IAccountProfile, TAppearance, TUpdateProfile } from '@pickflick/contracts';
import { cache } from 'react';

import { requestApi } from '#lib/api.server';

export const getAccount = cache(() => requestApi<IAccountProfile>('/account'));
export const updateAccountProfile = (input: TUpdateProfile) =>
    requestApi<IAccountProfile>('/account/profile', { method: 'PUT', json: input });
export const updateAccountAppearance = (input: TAppearance) =>
    requestApi<IAccountProfile>('/account/appearance', { method: 'PUT', json: input });
export const replaceAccountAvatar = (body: ArrayBuffer, contentType: string) =>
    requestApi('/account/avatar', { method: 'PUT', body, contentType });
export const removeAccountAvatar = () => requestApi('/account/avatar', { method: 'DELETE' });
