import ControlShell from '#components/shells/ControlShell/ControlShell';

export default function LibraryLoading() {
    return (
        <ControlShell
            title="My Library"
            description="Your ratings and films to watch, at your own pace."
            currentArea="library"
            clubItems={[]}
            items={[
                { label: 'My Ratings', href: '/library?tab=my-ratings' },
                { label: 'Watchlist', href: '/library?tab=watchlist' },
                { label: 'Achievements', href: '/library?tab=achievements' },
            ]}
        >
            <p role="status">Loading your Library…</p>
        </ControlShell>
    );
}
