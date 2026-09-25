import 'server-only';

import type { TContactSubmission } from '@pickflick/contracts';

import { apiRequest } from '@/lib/api.server';

export const sendContactMessage = (submission: TContactSubmission): Promise<void> =>
    apiRequest('/contact', { method: 'POST', json: submission });
