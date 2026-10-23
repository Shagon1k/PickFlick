import LoadingState from '#components/ui/LoadingState/LoadingState';

/** Shown at once on a Hub tab switch; the switcher and Call Sheet stay mounted above it. */
export default function HubPanelLoading() {
    return <LoadingState label="Loading Club section…" variant="cards" />;
}
