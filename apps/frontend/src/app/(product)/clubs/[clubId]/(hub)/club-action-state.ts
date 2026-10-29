export interface IClubActionState {
    message: string;
    revision: number;
    status: 'idle' | 'error' | 'success';
}

export const initialClubActionState: IClubActionState = {
    message: '',
    revision: 0,
    status: 'idle',
};
