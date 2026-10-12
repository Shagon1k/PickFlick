import 'server-only';

import {
    nominationsSchema,
    type TCloseNomination,
    type TSubmitNomination,
} from '@pickflick/contracts';

import { apiRequest } from '@/lib/api.server';

export async function getNominations(id: string) {
    return nominationsSchema.parse(await apiRequest(`/sessions/${id}/nominations`));
}
export async function submitNomination(id: string, input: TSubmitNomination) {
    return nominationsSchema.parse(
        await apiRequest(`/sessions/${id}/nominations`, { method: 'POST', json: input }),
    );
}
export async function closeNominations(id: string, input: TCloseNomination) {
    return nominationsSchema.parse(
        await apiRequest(`/sessions/${id}/nominations/close`, { method: 'POST', json: input }),
    );
}
