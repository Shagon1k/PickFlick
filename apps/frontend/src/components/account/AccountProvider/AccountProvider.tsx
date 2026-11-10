'use client';

import type { IAccountProfile } from '@pickflick/contracts';
import { type ReactNode, useEffect, useState } from 'react';

import { AccountContext } from '#components/account/account-context';

export default function AccountProvider({
    initialAccount,
    children,
}: {
    initialAccount: IAccountProfile | null;
    children: ReactNode;
}) {
    const [account, setAccount] = useState(initialAccount);
    const [previousAccount, setPreviousAccount] = useState(initialAccount);
    if (previousAccount !== initialAccount) {
        setPreviousAccount(initialAccount);
        setAccount(initialAccount);
    }
    useEffect(() => {
        document.documentElement.dataset.quietMode = String(account?.appearance.quietMode ?? false);
        return () => {
            delete document.documentElement.dataset.quietMode;
        };
    }, [account?.appearance.quietMode]);
    return (
        <AccountContext value={{ account, setAccount }}>
            <div
                data-monochrome={account?.appearance.monochrome || undefined}
                data-list-spacing={account?.appearance.listSpacing ?? 'comfortable'}
            >
                {children}
            </div>
        </AccountContext>
    );
}
