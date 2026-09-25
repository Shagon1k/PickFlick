import { randomUUID } from 'node:crypto';

import { ClubConflictError } from '../../src/clubs/club.errors.js';
import { createdClubIds, database, ids, management, onboarding, principal } from './harness.js';

export async function checkClubCreation() {
    const creationAttempts = await Promise.allSettled([
        onboarding.create(principal(ids.creator), {
            name: '  Midnight Society  ',
            description: '  Noir, classics, and arguments.  ',
            selectionScaleMin: 0,
            selectionScaleMax: 7,
        }),
        onboarding.create(principal(ids.creator), {
            name: 'Second Club',
            selectionScaleMin: 1,
            selectionScaleMax: 5,
        }),
    ]);
    const fulfilledCreations = creationAttempts.filter(
        (
            attempt,
        ): attempt is PromiseFulfilledResult<Awaited<ReturnType<typeof onboarding.create>>> =>
            attempt.status === 'fulfilled',
    );
    const rejectedCreations = creationAttempts.filter(
        (attempt): attempt is PromiseRejectedResult => attempt.status === 'rejected',
    );
    if (
        fulfilledCreations.length !== 1 ||
        rejectedCreations.length !== 1 ||
        !(rejectedCreations[0]?.reason instanceof ClubConflictError)
    ) {
        throw new Error(
            'Concurrent first-Club creation did not enforce the Free Admin Club limit.',
        );
    }
    const createdClub = fulfilledCreations[0]?.value.club;
    createdClubIds.created = createdClub?.id;
    if (
        !createdClub ||
        createdClub.name !== 'Midnight Society' ||
        createdClub.description !== 'Noir, classics, and arguments.' ||
        createdClub.membershipRole !== 'ADMIN' ||
        createdClub.tier !== 'FREE' ||
        createdClub.selectionScaleMin !== 0 ||
        createdClub.selectionScaleMax !== 7
    ) {
        throw new Error(
            'First-Club creation did not preserve the validated Free defaults and scale.',
        );
    }
    const createdMemberships = await database.membership.findMany({
        where: { clubId: createdClub.id },
        select: { role: true, status: true, userId: true },
    });
    if (
        createdMemberships.length !== 1 ||
        createdMemberships[0]?.userId !== ids.creator ||
        createdMemberships[0].role !== 'ADMIN' ||
        createdMemberships[0].status !== 'ACTIVE'
    ) {
        throw new Error(
            'First-Club creation did not atomically create the sole active Admin Membership.',
        );
    }
    const creatorClubs = await onboarding.list(principal(ids.creator));
    if (creatorClubs.clubs.length !== 1 || creatorClubs.clubs[0]?.id !== createdClub.id) {
        throw new Error("The creator's Club collection did not include the new Club.");
    }

    const [reactivationAttempt, competingCreationAttempt] = await Promise.allSettled([
        management.changeLifecycle(
            principal(ids.reactivationAdmin),
            ids.reactivationClub,
            'reactivate',
            {
                operationId: randomUUID(),
            },
        ),
        onboarding.create(principal(ids.reactivationAdmin), {
            name: 'Competing active Club',
            selectionScaleMin: 0,
            selectionScaleMax: 7,
        }),
    ]);
    if (competingCreationAttempt.status === 'fulfilled') {
        createdClubIds.reactivation = competingCreationAttempt.value.club.id;
    }
    const limitAttempts = [reactivationAttempt, competingCreationAttempt];
    const limitSuccesses = limitAttempts.filter((attempt) => attempt.status === 'fulfilled');
    const limitConflicts = limitAttempts.filter(
        (attempt): attempt is PromiseRejectedResult =>
            attempt.status === 'rejected' && attempt.reason instanceof ClubConflictError,
    );
    const activeAdminClubCount = await database.membership.count({
        where: {
            userId: ids.reactivationAdmin,
            role: 'ADMIN',
            status: 'ACTIVE',
            club: { deletedAt: null, lifecycle: 'ACTIVE' },
        },
    });
    if (limitSuccesses.length !== 1 || limitConflicts.length !== 1 || activeAdminClubCount !== 1) {
        throw new Error(
            'Concurrent Club creation and reactivation did not enforce the Free Admin Club limit.',
        );
    }
    return { createdClub };
}
