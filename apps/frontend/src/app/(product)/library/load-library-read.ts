import { HTTP_STATUS } from '@pickflick/contracts';
import { redirect } from 'next/navigation';

import { buildLoginPath } from '#api/auth-session.server';
import { ApiError } from '#lib/api.server';

export async function loadLibraryRead<TData>(request: () => Promise<TData>, returnPath: string) {
    try {
        return await request();
    } catch (error) {
        if (error instanceof ApiError && error.status === HTTP_STATUS.UNAUTHORIZED)
            redirect(buildLoginPath(returnPath));
        if (
            error instanceof ApiError ||
            error instanceof TypeError ||
            (error instanceof DOMException && error.name === 'TimeoutError')
        )
            return null;
        throw error;
    }
}
