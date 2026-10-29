import type { IClubHub, IClubSettings } from '@pickflick/contracts';
import type { Metadata } from 'next';
import { connection } from 'next/server';

import { getClubHub, getClubSettings } from '#api/clubs.server';
import { getSessionRoster } from '#api/session-roster.server';
import { getSession } from '#api/sessions.server';

import HubLoadFailure from '../../_components/HubLoadFailure/HubLoadFailure';
import HubPanel from '../../_components/HubPanel/HubPanel';
import ClubSettings from './_components/ClubSettings/ClubSettings';

export const metadata: Metadata = {
    title: 'Club settings — PickFlick',
    description: 'Manage one private PickFlick Club.',
};

export default async function ClubSettingsPage({
    params,
}: {
    params: Promise<{ clubId: string }>;
}) {
    await connection();
    const { clubId } = await params;
    let settings: IClubSettings;
    let hub;
    try {
        [settings, hub] = await Promise.all([getClubSettings(clubId), getClubHub(clubId)]);
    } catch (error) {
        return (
            <HubLoadFailure
                error={error}
                title="Club settings are temporarily unavailable"
                returnPath={`/clubs/${clubId}/settings`}
            />
        );
    }
    return (
        <HubPanel hub={hub}>
            <ClubSettings
                projection={settings}
                hub={hub}
                activeSession={await loadActiveSession(hub)}
            />
        </HubPanel>
    );
}

/** The active Session's controls need its versions and roster; without them the card stays read-only. */
async function loadActiveSession(hub: IClubHub) {
    const id = hub.activeSession?.id;
    if (!id || !hub.permissions.manageSessions) return null;
    try {
        const [session, roster] = await Promise.all([getSession(id), getSessionRoster(id)]);
        return { session, roster };
    } catch (error) {
        console.error('Manage Club Session controls unavailable.', { sessionId: id, error });
        return null;
    }
}
