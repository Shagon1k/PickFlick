import { type IClubSettings } from '@pickflick/contracts';

export type TVisibilityName =
    | 'showNominationAuthors'
    | 'showNominationsBeforeSubmit'
    | 'showVoteResults'
    | 'showRatingResults'
    | 'useMonochromeMedia';

export const visibilityOptions: ReadonlyArray<{
    readonly name: TVisibilityName;
    readonly label: string;
}> = [
    { name: 'showNominationAuthors', label: 'Show who nominated each film' },
    { name: 'showNominationsBeforeSubmit', label: 'Show nominations before I submit' },
    { name: 'showVoteResults', label: 'Show Selection results after the round closes' },
    { name: 'showRatingResults', label: 'Show ratings after the round closes' },
    { name: 'useMonochromeMedia', label: 'Use black & white posters and trailers' },
];

export function isWritable(projection: IClubSettings): boolean {
    return projection.permissions.manageSettings && projection.club.lifecycle === 'ACTIVE';
}
