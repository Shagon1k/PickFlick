import { z } from 'zod';

export const deleteAccountSchema = z.strictObject({ confirmation: z.literal('DELETE') });
export type TDeleteAccount = z.infer<typeof deleteAccountSchema>;
