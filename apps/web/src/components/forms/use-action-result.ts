'use client';

import { useState } from 'react';

/**
 * Applies each new server-action result exactly once, during render, so form state never lags a
 * render behind the result. DOM side effects such as focus or navigation stay in an effect.
 */
export function useActionResult<State extends { readonly revision: number }>(
    state: State,
    apply: (state: State) => void,
): void {
    const [appliedRevision, setAppliedRevision] = useState(state.revision);
    if (state.revision !== appliedRevision) {
        setAppliedRevision(state.revision);
        apply(state);
    }
}
