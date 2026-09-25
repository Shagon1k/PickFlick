import { BRAND_ASSETS } from '../brand-assets';

describe('BRAND_ASSETS', () => {
    const assets = Object.entries(BRAND_ASSETS);

    it('should size every approved asset', () => {
        expect(assets).toHaveLength(24);
        expect(assets.every(([, asset]) => asset.width > 0 && asset.height > 0)).toBe(true);
    });

    it('should flag the one asset with baked-in text', () => {
        expect(
            assets.filter(([, asset]) => asset.containsEmbeddedText).map(([key]) => key),
        ).toEqual(['invitationCampaign']);
    });
});
