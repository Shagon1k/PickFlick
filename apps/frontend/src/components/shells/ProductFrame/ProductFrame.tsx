import type { ReactNode } from 'react';

import ProductChrome from '#components/shells/ProductChrome/ProductChrome';
import type { IShellNavigationItem, IShellRouteMap } from '#components/shells/shell-navigation';

interface IProductFrameProps {
    isAdmin?: boolean;
    children: ReactNode;
    clubItems?: readonly IShellNavigationItem[];
    currentArea?: 'hub' | 'movie' | 'recovery' | 'session';
    sessionBackHref?: string;
    routes?: IShellRouteMap;
}

export default function ProductFrame({
    isAdmin = false,
    children,
    clubItems = [],
    currentArea = 'hub',
    routes,
    sessionBackHref,
}: IProductFrameProps) {
    return (
        <ProductChrome
            isAdmin={isAdmin}
            clubItems={clubItems}
            currentArea={currentArea}
            routes={routes}
            sessionBackHref={sessionBackHref}
        >
            {children}
        </ProductChrome>
    );
}
