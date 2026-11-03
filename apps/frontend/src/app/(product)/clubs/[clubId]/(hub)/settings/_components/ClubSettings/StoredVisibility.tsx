'use client';

import { type IClubSettings } from '@pickflick/contracts';

import { visibilityNames } from './club-settings';

export default function StoredVisibility({ projection }: { projection: IClubSettings }) {
    return (
        <>
            {visibilityNames
                .filter((name) => projection.visibility[name])
                .map((name) => (
                    <input key={name} name={name} type="hidden" value="on" />
                ))}
        </>
    );
}
