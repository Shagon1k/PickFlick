import { HTTP_STATUS } from '@pickflick/contracts';
import type { ReactNode } from 'react';

import { getAccount } from '#api/account.server';
import AccountProvider from '#components/account/AccountProvider/AccountProvider';
import Alert from '#components/ui/Alert/Alert';
import { ApiError } from '#lib/api.server';

export default async function ProductLayout({ children }: { children: ReactNode }) {
    let account = null;
    let hasAccountError = false;
    try {
        account = await getAccount();
    } catch (error) {
        if (
            !(
                error instanceof ApiError ||
                error instanceof TypeError ||
                (error instanceof DOMException && error.name === 'TimeoutError')
            )
        )
            throw error;
        hasAccountError = !(error instanceof ApiError && error.status === HTTP_STATUS.UNAUTHORIZED);
        if (hasAccountError) console.error('Account preferences could not be loaded.');
    }
    return (
        <AccountProvider initialAccount={account}>
            {hasAccountError ? (
                <Alert tone="warning">
                    Your display preferences could not be loaded. Reload to try again.
                </Alert>
            ) : null}
            {children}
        </AccountProvider>
    );
}
