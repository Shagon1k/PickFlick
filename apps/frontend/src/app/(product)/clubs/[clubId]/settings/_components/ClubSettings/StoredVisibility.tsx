'use client';

import { type IClubSettings } from '@pickflick/contracts';

import { visibilityOptions } from './club-settings';

export default function StoredVisibility({ projection }: { projection: IClubSettings }) {
    return (
        <>
            {visibilityOptions
                .filter(({ name }) => projection.visibility[name])
                .map(({ name }) => (
                    <input key={name} name={name} type="hidden" value="on" />
                ))}
        </>
    );
}
