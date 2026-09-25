export type ClubFieldName = 'name' | 'description' | 'selectionScaleMin' | 'selectionScaleMax';

export interface ClubFormValues {
    readonly name: string;
    readonly description: string;
    readonly selectionScaleMin: string;
    readonly selectionScaleMax: string;
}

export type ClubFieldErrors = Partial<Record<ClubFieldName, string>>;
