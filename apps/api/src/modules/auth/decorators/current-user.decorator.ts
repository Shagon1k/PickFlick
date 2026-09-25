import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { IAuthenticatedRequest, IAuthUser } from '../auth.types.js';

/** The User the authentication guard resolved for this request. */
export const CurrentUser = createParamDecorator(
    (_data: unknown, context: ExecutionContext): IAuthUser => {
        const user = context.switchToHttp().getRequest<IAuthenticatedRequest>().user;
        if (!user) {
            throw new Error('CurrentUser used on a route without the authentication guard.');
        }
        return user;
    },
);
