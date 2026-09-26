import type { ImgHTMLAttributes } from 'react';

import { BRAND_ASSETS, type TBrandAssetKey } from './brand-assets';

export interface IBrandImageProps extends Omit<
    ImgHTMLAttributes<HTMLImageElement>,
    'alt' | 'height' | 'src' | 'width'
> {
    asset: TBrandAssetKey;
    alt: string;
}

export default function BrandImage({ alt, asset, loading = 'lazy', ...props }: IBrandImageProps) {
    const selected = BRAND_ASSETS[asset];
    return (
        // Brand assets ship as pre-sized WebP files with fixed dimensions; the image optimizer would
        // only re-encode them on the server.
        // eslint-disable-next-line @next/next/no-img-element -- see above
        <img
            {...props}
            alt={alt}
            decoding="async"
            height={selected.height}
            loading={loading}
            src={selected.source.src}
            width={selected.width}
        />
    );
}
