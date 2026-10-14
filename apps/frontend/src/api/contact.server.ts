import 'server-only';

import type { TContactSubmission } from '@pickflick/contracts';

import { requestApi } from '#lib/api.server';

export const sendContactMessage = (submission: TContactSubmission): Promise<void> =>
    requestApi('/contact', { method: 'POST', json: submission });
