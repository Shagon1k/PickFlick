import type { ReactNode } from 'react';

import ProductChrome from '#components/shells/ProductChrome/ProductChrome';
import type { IShellNavigationItem, IShellRouteMap } from '#components/shells/shell-navigation';

interface IProductFrameProps {
    admin?: boolean;
    children: ReactNode;
    clubItems?: readonly IShellNavigationItem[];
    currentArea?: 'hub' | 'recovery' | 'session';
    sessionBackHref?: string;
    routes?: IShellRouteMap;
}

export default function ProductFrame({
    admin = false,
    children,
    clubItems = [],
    currentArea = 'hub',
    routes,
    sessionBackHref,
}: IProductFrameProps) {
    return (
        <ProductChrome
            admin={admin}
            clubItems={clubItems}
            currentArea={currentArea}
            routes={routes}
            sessionBackHref={sessionBackHref}
        >
            {children}
        </ProductChrome>
    );
}
