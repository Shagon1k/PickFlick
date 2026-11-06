import HubLoading from '../_components/HubLoading/HubLoading';

/** Shown at once on a Hub tab switch; the switcher and Call Sheet stay mounted above it. */
export default function HubPanelLoading() {
    return <HubLoading label="Loading Club overview…" variant="overview" />;
}
