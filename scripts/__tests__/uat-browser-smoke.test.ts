import { describe, expect, it } from 'vitest';

import { browserSmokeConfiguration, isPickFlickDocumentTitle } from '../uat-browser-smoke.mjs';

describe('UAT browser smoke configuration', () => {
    it('resolves the artifact directory without a deployment revision', () => {
        const configuration = browserSmokeConfiguration({
            PLAYWRIGHT_BASE_URL: 'https://uat.pick-flick.app',
            UAT_SMOKE_ARTIFACT_DIR: 'artifacts/uat',
        });

        expect(configuration.artifactDirectory).toMatch(/artifacts\/uat$/);
    });

    it('accepts branded page titles with route-specific metadata', () => {
        expect(isPickFlickDocumentTitle('PickFlick')).toBe(true);
        expect(
            isPickFlickDocumentTitle(
                'PickFlick — Pick a film. Watch together. Remember everything.',
            ),
        ).toBe(true);
        expect(isPickFlickDocumentTitle('A different product')).toBe(false);
    });

    it('rejects a non-canonical preview URL', () => {
        expect(() =>
            browserSmokeConfiguration({
                PLAYWRIGHT_BASE_URL: 'https://preview.example.invalid',
                SOURCE_REVISION: 'a'.repeat(40),
            }),
        ).toThrow(/must be https:\/\/uat\.pick-flick\.app/);
    });

    it("accepts the landing page's branded metadata title", () => {
        expect(
            isPickFlickDocumentTitle(
                'PickFlick — Pick a film. Watch together. Remember everything.',
            ),
        ).toBe(true);
        expect(isPickFlickDocumentTitle('A different product')).toBe(false);
    });
});
