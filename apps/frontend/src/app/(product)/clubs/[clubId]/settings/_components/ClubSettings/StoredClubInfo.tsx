'use client';

import { type IClubSettings } from '@pickflick/contracts';

/**
 * Club Info and Settings save through one settings action; each card submits its own fields and
 * carries the other card's stored values so a save never resets what the other card shows.
 */
export default function StoredClubInfo({ projection }: { projection: IClubSettings }) {
    return (
        <>
            <input name="name" type="hidden" value={projection.club.name} />
            <input name="description" type="hidden" value={projection.club.description ?? ''} />
            <input
                name="selectionScaleMin"
                type="hidden"
                value={projection.club.selectionScaleMin}
            />
            <input
                name="selectionScaleMax"
                type="hidden"
                value={projection.club.selectionScaleMax}
            />
        </>
    );
}
