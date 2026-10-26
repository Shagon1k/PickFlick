import { selectUiFiles } from '../run-ui-checks.mjs';

const files = [
    'tests/ui/club-hub.spec.ts',
    'tests/ui/club-ratings.spec.ts',
    'tests/ui/library.spec.ts',
    'tests/ui/achievements.spec.ts',
    'tests/ui/personal-rating.spec.ts',
    'tests/ui/watchlist.spec.ts',
    'tests/ui/movie-details.spec.ts',
    'tests/ui/phase-states-visual.spec.ts',
    'tests/ui/selection.spec.ts',
    'tests/ui/public-pages.spec.ts',
];

describe('PR UI test selection', () => {
    it('should check Library changes and their shared rating, Watchlist and Club surfaces', () => {
        expect(selectUiFiles(['apps/frontend/src/app/(product)/library/page.tsx'], files)).toEqual([
            'tests/ui/achievements.spec.ts',
            'tests/ui/club-ratings.spec.ts',
            'tests/ui/library.spec.ts',
            'tests/ui/movie-details.spec.ts',
            'tests/ui/personal-rating.spec.ts',
            'tests/ui/phase-states-visual.spec.ts',
            'tests/ui/watchlist.spec.ts',
        ]);
    });

    it('should combine areas and directly changed tests without duplicates', () => {
        expect(
            selectUiFiles(
                [
                    'apps/frontend/src/components/sessions/RatingClose/RatingClose.tsx',
                    'apps/frontend/src/app/(marketing)/pricing/page.tsx',
                    'tests/ui/selection.spec.ts',
                ],
                files,
            ),
        ).toEqual([
            'tests/ui/club-hub.spec.ts',
            'tests/ui/phase-states-visual.spec.ts',
            'tests/ui/public-pages.spec.ts',
            'tests/ui/selection.spec.ts',
        ]);
    });

    it.each([
        'apps/frontend/src/components/ui/Button/Button.tsx',
        'apps/frontend/src/components/movies/FilmMeta/FilmMeta.module.scss',
        'apps/frontend/src/app/(product)/layout.tsx',
        'tests/ui/library.ts',
        'tests/ui/__screenshots__/ui-preview-s-390.png',
        'packages/contracts/src/library.ts',
        'pnpm-lock.yaml',
        '.github/workflows/ci.yml',
        'scripts/run-ui-checks.mjs',
    ])('should run the full suite for shared input %s', (path) => {
        expect(selectUiFiles([path], files)).toBeNull();
    });

    it('should skip UI checks for documentation and backend-only changes', () => {
        expect(selectUiFiles(['_docs/ui-quality.md', 'apps/backend/src/main.ts'], files)).toEqual(
            [],
        );
    });

    it('should keep a feature PR scoped when it updates its baselines', () => {
        expect(
            selectUiFiles(
                [
                    'apps/frontend/src/app/(product)/library/page.tsx',
                    'tests/ui/__screenshots__/library-ratings-s-390.png',
                    'tests/ui/__screenshots__/library-ratings-xl-1440.png',
                ],
                files,
            ),
        ).toEqual(selectUiFiles(['apps/frontend/src/app/(product)/library/page.tsx'], files));
    });
});
