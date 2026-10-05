import { Logger } from '@nestjs/common';

import { authLogger } from '../auth-logger.js';

describe('Auth provider logging', () => {
    it('should preserve severity without disclosing provider messages or error arguments', () => {
        const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
        authLogger.log?.(
            'error',
            '/invite/club/synthetic-private-link',
            new Error('synthetic-private-token'),
        );
        expect(error).toHaveBeenCalledExactlyOnceWith('Authentication provider reported an event.');
        error.mockRestore();
    });
});
