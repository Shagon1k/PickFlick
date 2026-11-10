'use client';

import { appearanceSchema, type IAccountProfile } from '@pickflick/contracts';
import { createContext, use } from 'react';

const DEFAULT_APPEARANCE = appearanceSchema.parse({});
export const AccountContext = createContext<{
    account: IAccountProfile | null;
    setAccount: (account: IAccountProfile) => void;
}>({ account: null, setAccount: () => undefined });
export const useAccount = () => use(AccountContext);
export const useAppearance = () => useAccount().account?.appearance ?? DEFAULT_APPEARANCE;
