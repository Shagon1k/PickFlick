const OFFLINE_MESSAGE =
    'You appear to be offline. Reconnect, then try again; nothing you entered is lost.';

/**
 * The copy to show instead of sending a request while the browser reports no network, or null
 * when online. Actions check it first so an offline tap explains itself instead of timing out.
 */
export function getOfflineMessage(): string | null {
    return navigator.onLine ? null : OFFLINE_MESSAGE;
}
