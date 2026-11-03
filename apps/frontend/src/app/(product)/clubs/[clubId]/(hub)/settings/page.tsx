import type { IClubHub, IClubSettings } from '@pickflick/contracts';
import type { Metadata } from 'next';
import { connection } from 'next/server';

import { getClubHub, getClubSettings } from '#api/clubs.server';
import { getSessionRoster } from '#api/session-roster.server';
import { getSession } from '#api/sessions.server';

import type { TRatingCloseControl } from '../../_components/ActiveRatings/ActiveRatings.types';
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
    const [activeSession, ratingControls] = await Promise.all([
        loadActiveSession(hub),
        loadRatingControls(hub),
    ]);
    return (
        <HubPanel hub={hub}>
            <ClubSettings
                projection={settings}
                hub={hub}
                activeSession={activeSession}
                ratingControls={ratingControls}
            />
        </HubPanel>
    );
}

async function loadRatingControls(hub: IClubHub): Promise<TRatingCloseControl[]> {
    if (!hub.permissions.manageSessions) return [];
    return Promise.all(
        hub.ratingSessions.map(async ({ id }): Promise<TRatingCloseControl> => {
            try {
                const session = await getSession(id);
                if (session.phase === 'RATING' && session.rating) {
                    return {
                        sessionId: id,
                        status: 'ready',
                        phaseVersion: session.phaseVersion,
                        rating: {
                            canClose: session.rating.canClose,
                            receivedCount: session.rating.receivedCount,
                            acceptedCount: session.rating.acceptedCount,
                            submittedCount: session.rating.submittedCount,
                        },
                    };
                }
            } catch (error) {
                console.error('Manage Club Rating controls unavailable.', { sessionId: id, error });
            }
            return { sessionId: id, status: 'unavailable' };
        }),
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
