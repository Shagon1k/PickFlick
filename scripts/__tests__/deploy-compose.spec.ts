import { deployCompose } from '../deploy-compose.mjs';

describe('deployment convergence', () => {
    const sourceRevision = 'a'.repeat(40);

    it('should use native Compose release ordering', () => {
        const commands: string[][] = [];
        const source = { APP_ENV: 'uat' };

        deployCompose(
            (arguments_) => commands.push(arguments_),
            source,
            () => sourceRevision,
        );

        expect(commands).toEqual([
            [
                'compose',
                '-f',
                'compose.deploy.yaml',
                'up',
                '--build',
                '-d',
                '--wait',
                '--remove-orphans',
            ],
        ]);
    });

    it('should surface a native Compose deployment failure', () => {
        const commands: string[][] = [];
        const source = { APP_ENV: 'uat' };

        expect(() =>
            deployCompose(
                (arguments_) => {
                    commands.push(arguments_);
                    throw new Error('release failed');
                },
                source,
                () => sourceRevision,
            ),
        ).toThrow('release failed');
        expect(commands).toEqual([
            [
                'compose',
                '-f',
                'compose.deploy.yaml',
                'up',
                '--build',
                '-d',
                '--wait',
                '--remove-orphans',
            ],
        ]);
    });

    it('should pass a validated revision so linked-worktree builds do not read the gitdir file', () => {
        const environments: NodeJS.ProcessEnv[] = [];
        const source = { APP_ENV: 'uat', STORAGE_BUCKET: 'pickflick-uat' };

        deployCompose(
            (_arguments, environment) => environments.push(environment),
            source,
            () => sourceRevision,
        );

        expect(environments).toEqual([{ ...source, SOURCE_REVISION: sourceRevision }]);
        expect(source).not.toHaveProperty('SOURCE_REVISION');
    });

    it('should does not start Compose when the source revision cannot be validated', () => {
        const commands: string[][] = [];

        expect(() =>
            deployCompose(
                (arguments_) => commands.push(arguments_),
                { APP_ENV: 'uat' },
                () => {
                    throw new Error('SOURCE_REVISION must be a full hexadecimal source revision.');
                },
            ),
        ).toThrow(/full hexadecimal source revision/);
        expect(commands).toEqual([]);
    });

    it('should refuses source-built production deployment', () => {
        const commands: string[][] = [];

        expect(() =>
            deployCompose((arguments_) => commands.push(arguments_), { APP_ENV: 'production' }),
        ).toThrow(/only run for APP_ENV=uat/);
        expect(commands).toEqual([]);
    });
});
