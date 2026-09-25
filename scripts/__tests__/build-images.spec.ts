import { sourceRevision } from '../build-images.mjs';
import { resolveImageRevision } from '../write-image-revision.mjs';

const headRevision = 'a'.repeat(40);

function gitWith({ head = headRevision, inside = true, status = '' } = {}) {
    return (arguments_: string[]) => {
        switch (arguments_.join(' ')) {
            case 'rev-parse --is-inside-work-tree':
                return { status: inside ? 0 : 128, stdout: inside ? 'true\n' : '' };
            case 'status --porcelain':
                return { status: 0, stdout: status };
            case 'rev-parse HEAD':
                return { status: 0, stdout: `${head}\n` };
            default:
                throw new Error(`Unexpected Git arguments: ${arguments_.join(' ')}`);
        }
    };
}

describe('production image source revision', () => {
    it('should accept a configured revision that matches a clean checkout', () => {
        expect(sourceRevision({ SOURCE_REVISION: headRevision }, gitWith())).toBe(headRevision);
    });

    it('should reject a configured revision that differs from Git HEAD', () => {
        expect(() => sourceRevision({ SOURCE_REVISION: 'b'.repeat(40) }, gitWith())).toThrow(
            /SOURCE_REVISION must match the checked-out Git HEAD/,
        );
    });

    it('should reject a dirty checkout even when a revision is configured', () => {
        expect(() =>
            sourceRevision(
                { SOURCE_REVISION: headRevision },
                gitWith({ status: ' M Dockerfile\n' }),
            ),
        ).toThrow(/dirty worktree/);
    });

    it('should use the configured revision when Git metadata is unavailable', () => {
        expect(sourceRevision({ SOURCE_REVISION: headRevision }, gitWith({ inside: false }))).toBe(
            headRevision,
        );
    });

    it('should accept a 64-character Git revision when Git metadata is unavailable', () => {
        const sha256Revision = 'b'.repeat(64);

        expect(
            sourceRevision({ SOURCE_REVISION: sha256Revision }, gitWith({ inside: false })),
        ).toBe(sha256Revision);
    });

    it.each([41, 63])('rejects a %i-character non-Git revision', (length) => {
        expect(() =>
            sourceRevision({ SOURCE_REVISION: 'b'.repeat(length) }, gitWith({ inside: false })),
        ).toThrow(/full hexadecimal source revision/);
    });
});

describe('image-embedded source revision', () => {
    it('should use the explicit build revision without reading Git metadata', () => {
        const readFile = vi.fn();

        expect(resolveImageRevision(headRevision.toUpperCase(), readFile)).toBe(headRevision);
        expect(readFile).not.toHaveBeenCalled();
    });

    it('should resolve a branch checkout from the minimal safe Git metadata', () => {
        const readFile = vi.fn((path: string) =>
            path === '.git/HEAD' ? 'ref: refs/heads/main\n' : `${headRevision}\n`,
        );

        expect(resolveImageRevision(undefined, readFile)).toBe(headRevision);
        expect(readFile).toHaveBeenCalledTimes(2);
    });

    it('should resolve a detached tag checkout directly from HEAD', () => {
        expect(resolveImageRevision(undefined, () => `${headRevision}\n`)).toBe(headRevision);
    });
});
