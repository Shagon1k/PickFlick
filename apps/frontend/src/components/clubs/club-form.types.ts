export type TClubFieldName = 'name' | 'description' | 'selectionScaleMin' | 'selectionScaleMax';

export interface IClubFormValues {
    name: string;
    description: string;
    selectionScaleMin: string;
    selectionScaleMax: string;
}

export type TClubFieldErrors = Partial<Record<TClubFieldName, string>>;
