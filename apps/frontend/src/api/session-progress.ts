import { sessionProgressSchema } from '@pickflick/contracts';

/** Same-origin, cookie-authenticated version signals; projections stay on the server. */
export function watchSessionProgress(
    id: string,
    callbacks: {
        progress: (version: number) => void;
        connected: (connected: boolean) => void;
        denied: () => void;
    },
) {
    const source = new EventSource(`/api/sessions/${id}/progress/events`);
    source.onopen = () => callbacks.connected(true);
    source.onerror = () => callbacks.connected(false);
    source.addEventListener('progress', (event: MessageEvent<string>) => {
        try {
            const signal = sessionProgressSchema.parse(JSON.parse(event.data));
            callbacks.progress(signal.version);
        } catch {
            callbacks.connected(false);
            source.close();
        }
    });
    source.addEventListener('access-lost', () => {
        source.close();
        callbacks.denied();
    });
    return () => source.close();
}
