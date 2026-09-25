import type { TDatabaseEnvironment } from '@pickflick/config/environment';

export function assertSafeSeedOrResetTarget(environment: TDatabaseEnvironment): void {
    if (environment.appEnvironment !== 'local' && environment.appEnvironment !== 'test') {
        throw new Error(
            `Database seed/reset is disabled for APP_ENV=${environment.appEnvironment}.`,
        );
    }

    const target = new URL(environment.databaseUrl);
    const databaseName = target.pathname.replace(/^\//, '');
    const expectedName = `pickflick_${environment.appEnvironment}`;
    if (databaseName !== expectedName) {
        throw new Error(`Database seed/reset requires the database name ${expectedName}.`);
    }

    if (target.searchParams.has('host')) {
        throw new Error('Database seed/reset does not allow a host query parameter.');
    }

    if (
        environment.appEnvironment === 'local' &&
        target.hostname !== '127.0.0.1' &&
        target.hostname !== 'localhost'
    ) {
        throw new Error('Local seed/reset requires a loopback database host.');
    }
}
