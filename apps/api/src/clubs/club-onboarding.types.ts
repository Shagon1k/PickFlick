import type { ClubSummary, CreateClubRequest } from '@pickflick/contracts';

export interface NormalizedCreateClubInput extends CreateClubRequest {
    readonly description?: string;
}

export interface PersistClubInput extends NormalizedCreateClubInput {
    readonly clubId: string;
    readonly creatorUserId: string;
    readonly membershipId: string;
}

export type StoredClubSummary = Omit<ClubSummary, 'tier'>;
