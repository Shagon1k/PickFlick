import type { AppRole } from '@pickflick/database';

/** The signed-in User the guard attaches to every protected request. */
export interface IAuthUser {
    id: string;
    appRole: AppRole;
    sessionId: string;
}

export interface IAuthenticatedRequest {
    headers: Record<string, string | string[] | undefined>;
    user?: IAuthUser;
}
