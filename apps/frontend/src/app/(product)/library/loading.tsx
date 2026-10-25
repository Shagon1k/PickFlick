import ControlShell from '#components/shells/ControlShell/ControlShell';

export default function LibraryLoading() {
    return (
        <ControlShell
            title="My Library"
            description="Films you want to watch, at your own pace."
            currentArea="library"
            clubItems={[]}
            items={[{ label: 'Watchlist', href: '/library?tab=watchlist', current: true }]}
        >
            <p role="status">Loading your Watchlist…</p>
        </ControlShell>
    );
}
