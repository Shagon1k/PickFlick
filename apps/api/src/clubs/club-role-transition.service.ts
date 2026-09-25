import { Inject, Injectable } from '@nestjs/common';
import type { ApplicationLogger } from '@pickflick/observability';

import { canonicalUuid, isUuid } from '../common/validation/uuid.js';
import { APPLICATION_LOGGER } from '../runtime.tokens.js';
import { ClubValidationError } from './club.errors.js';
import { operationRequestHash } from './club-operation-replay.js';
import {
    ClubRoleRepository,
    type ChangeMembershipRoleInput,
    type ClubTransitionResult,
    type TransferAdministrationInput,
} from './club-role.repository.js';

function assertUuid(value: string, field: string): void {
    if (!isUuid(value)) {
        throw new ClubValidationError(`${field} must be a UUID.`);
    }
}

@Injectable()
export class ClubRoleTransitionService {
    constructor(
        private readonly repository: ClubRoleRepository,
        @Inject(APPLICATION_LOGGER) private readonly logger: ApplicationLogger,
    ) {}

    async changeMembershipRole(input: ChangeMembershipRoleInput): Promise<ClubTransitionResult> {
        assertUuid(input.actorUserId, 'actorUserId');
        assertUuid(input.clubId, 'clubId');
        assertUuid(input.operationId, 'operationId');
        assertUuid(input.targetMembershipId, 'targetMembershipId');
        if (input.nextRole !== 'MODERATOR' && input.nextRole !== 'MEMBER') {
            throw new ClubValidationError('nextRole must be MODERATOR or MEMBER.');
        }
        const result = await this.repository.changeMembershipRole({
            ...input,
            requestHash: operationRequestHash('membership-role', {
                nextRole: input.nextRole,
                targetMembershipId: canonicalUuid(input.targetMembershipId),
            }),
        });
        if (result.changed && !result.replayed) {
            this.logger.info(
                { event: 'club.membership.role_changed' },
                'Club Membership role changed.',
            );
        }
        return result;
    }

    async transferAdministration(
        input: TransferAdministrationInput,
    ): Promise<ClubTransitionResult> {
        assertUuid(input.actorUserId, 'actorUserId');
        assertUuid(input.clubId, 'clubId');
        assertUuid(input.operationId, 'operationId');
        assertUuid(input.targetMembershipId, 'targetMembershipId');
        if (
            input.previousAdminNextRole !== 'MODERATOR' &&
            input.previousAdminNextRole !== 'MEMBER'
        ) {
            throw new ClubValidationError('previousAdminNextRole must be MODERATOR or MEMBER.');
        }
        const result = await this.repository.transferAdministration({
            ...input,
            requestHash: operationRequestHash('admin-transfer', {
                previousAdminNextRole: input.previousAdminNextRole,
                targetMembershipId: canonicalUuid(input.targetMembershipId),
            }),
        });
        if (result.changed && !result.replayed) {
            this.logger.info(
                { event: 'club.admin.transferred' },
                'Club administration transferred.',
            );
        }
        return result;
    }
}
