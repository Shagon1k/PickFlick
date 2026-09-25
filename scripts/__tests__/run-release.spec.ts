import { assertReleaseEnvironment, releaseSteps, runReleaseSteps } from '../run-release.mjs';

describe('release gate', () => {
    it('should run migrations before the required seed step', async () => {
        const completed: string[] = [];

        await runReleaseSteps(async (step) => {
            completed.push(step.name);
        });

        expect(completed).toEqual(['migrations', 'required seed']);
    });

    it('should fail without completing when a release step fails', async () => {
        const runner = vi.fn(async (step: (typeof releaseSteps)[number]) => {
            if (step.name === 'required seed') {
                throw new Error('injected seed failure');
            }
        });

        await expect(runReleaseSteps(runner)).rejects.toThrow('injected seed failure');
        expect(runner).toHaveBeenCalledTimes(2);
    });

    it('should allow only shared UAT and production release scopes', () => {
        expect(() => assertReleaseEnvironment('uat')).not.toThrow();
        expect(() => assertReleaseEnvironment('production')).not.toThrow();
        expect(() => assertReleaseEnvironment('local')).toThrow(/only run/);
        expect(() => assertReleaseEnvironment('test')).toThrow(/only run/);
    });
});
