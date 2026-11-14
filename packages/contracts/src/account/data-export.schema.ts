import { z } from 'zod';

export const requestDataExportSchema = z.strictObject({ requestId: z.uuidv4() });
export type TRequestDataExport = z.infer<typeof requestDataExportSchema>;

export const dataExportDownloadQuerySchema = z.strictObject({
    expires: z.string().regex(/^\d{13}$/u),
    signature: z.string().regex(/^[a-f0-9]{64}$/u),
});
export type TDataExportDownloadQuery = z.infer<typeof dataExportDownloadQuerySchema>;

export const dataExportJobSchema = z.strictObject({
    id: z.uuidv4(),
    status: z.enum(['PENDING', 'PROCESSING', 'READY', 'FAILED', 'EXPIRED']),
    attemptCount: z.number().int().nonnegative(),
    createdAt: z.iso.datetime(),
    completedAt: z.iso.datetime().nullable(),
    expiresAt: z.iso.datetime().nullable(),
    nextAttemptAt: z.iso.datetime().nullable(),
    failure: z.enum(['GENERATION_FAILED', 'ACCOUNT_UNAVAILABLE']).nullable(),
});
export type TDataExportJob = z.infer<typeof dataExportJobSchema>;

export const dataExportLinkSchema = z.strictObject({
    url: z.string(),
    expiresAt: z.iso.datetime(),
});
export type TDataExportLink = z.infer<typeof dataExportLinkSchema>;
