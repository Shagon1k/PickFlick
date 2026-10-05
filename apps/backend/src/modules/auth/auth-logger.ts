import { Logger } from '@nestjs/common';
import type { BetterAuthOptions } from 'better-auth';

const logger = new Logger('Authentication');

// Provider error arguments can contain OAuth return paths and raw invitation tokens.
export const authLogger: NonNullable<BetterAuthOptions['logger']> = {
    level: 'warn',
    log(level) {
        const message = 'Authentication provider reported an event.';
        switch (level) {
            case 'error':
                logger.error(message);
                break;
            case 'warn':
                logger.warn(message);
                break;
            case 'info':
                logger.log(message);
                break;
            case 'debug':
                logger.debug(message);
                break;
        }
    },
};
