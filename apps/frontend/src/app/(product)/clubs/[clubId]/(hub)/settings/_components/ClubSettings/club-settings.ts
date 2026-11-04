import type { IClubSettings, IClubVisibility } from '@pickflick/contracts';

export const visibilityOptions: {
    label: string;
    during: keyof IClubVisibility;
    after: keyof IClubVisibility;
}[] = [
    {
        label: 'Show who nominated each film',
        during: 'showNominationAuthorsDuring',
        after: 'showNominationAuthorsAfter',
    },
    {
        label: 'Show each member’s Selection scores',
        during: 'showSelectionScoresDuring',
        after: 'showSelectionScoresAfter',
    },
    { label: 'Show individual ratings', during: 'showRatingsDuring', after: 'showRatingsAfter' },
];

export const visibilityNames: (keyof IClubVisibility)[] = [
    ...visibilityOptions.flatMap(({ during, after }) => [during, after]),
    'showNominationsBeforeSubmit',
];

export function isWritable(projection: IClubSettings): boolean {
    return projection.permissions.manageSettings && projection.club.lifecycle === 'ACTIVE';
}
