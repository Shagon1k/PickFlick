import { z } from 'zod';

import { singleLineText } from '../common/text.js';

export const DISPLAY_NAME_MAX_LENGTH = 80;
export const ACCOUNT_AVATAR_MAX_BYTES = 512 * 1024;
export const OPTIONAL_TABLE_COLUMNS = ['rank', 'year', 'genre', 'date'] as const;

export const accountAvatarQuerySchema = z.strictObject({
    v: z
        .string()
        .regex(/^[a-f0-9]{64}$/u)
        .optional(),
});
export type TAccountAvatarQuery = z.infer<typeof accountAvatarQuerySchema>;

export const appearanceSchema = z.strictObject({
    monochrome: z.boolean().default(false),
    colorReveal: z.boolean().default(true),
    quietMode: z.boolean().default(false),
    listSpacing: z.enum(['comfortable', 'compact']).default('comfortable'),
    hiddenColumns: z.array(z.enum(OPTIONAL_TABLE_COLUMNS)).max(4).default([]),
});
export type TAppearance = z.infer<typeof appearanceSchema>;

export const updateProfileSchema = z.strictObject({
    displayName: singleLineText(1, DISPLAY_NAME_MAX_LENGTH),
    locale: z.literal('en'),
});
export type TUpdateProfile = z.infer<typeof updateProfileSchema>;

export interface IAccountProfile {
    id: string;
    displayName: string;
    email: string;
    providers: string[];
    locale: string;
    avatarUrl: string | null;
    appearance: TAppearance;
}
