import { randomUUID } from 'node:crypto';

import { SYNTHETIC_FIXTURES } from '@pickflick/database';

import { ClubAuthorizationError, ClubConflictError } from '../../src/clubs/club.errors.js';
import { avatarStorage, database, ids, management, principal } from './harness.js';

// A call, not a property read, so each check sees the live count instead of a narrowed literal.
const storedAvatarCount = (): number => avatarStorage.objects.size;

export async function checkClubManagement() {
    const adminless = await management.project(principal(ids.member), ids.adminlessClub);
    if (adminless.club.membershipRole !== 'MEMBER' || adminless.permissions.manageLifecycle) {
        throw new Error('An adminless Club granted ownership-sensitive actions to a Member.');
    }

    const settingsOperationId = randomUUID();
    const settingsInput = {
        operationId: settingsOperationId,
        name: 'Club boundary updated',
        description: 'Audited settings check.',
        selectionScaleMin: 0,
        selectionScaleMax: 8,
        showNominationAuthors: false,
        showNominationsBeforeSubmit: true,
        showVoteResults: false,
        showRatingResults: true,
        useMonochromeMedia: false,
    };
    for (const privateClubId of [ids.club, SYNTHETIC_FIXTURES.club.id]) {
        await management
            .updateSettings(principal(ids.outsider), privateClubId, {
                ...settingsInput,
                operationId: randomUUID(),
                showVoteResults: true,
            })
            .then(
                () => {
                    throw new Error('A non-member changed private Club settings.');
                },
                (error: unknown) => {
                    if (!(error instanceof ClubAuthorizationError)) {
                        throw error;
                    }
                },
            );
    }
    await management
        .updateSettings(principal(ids.admin), ids.club, {
            ...settingsInput,
            operationId: randomUUID(),
            showVoteResults: true,
        })
        .then(
            () => {
                throw new Error('A Free Club enabled ordinary-member vote results.');
            },
            (error: unknown) => {
                if (!(error instanceof ClubConflictError)) {
                    throw error;
                }
            },
        );
    const settings = await management.updateSettings(principal(ids.admin), ids.club, settingsInput);
    const settingsRetry = await management.updateSettings(
        principal(ids.admin),
        ids.club,
        settingsInput,
    );
    if (
        !settings.changed ||
        settings.replayed ||
        !settingsRetry.replayed ||
        settingsRetry.settings.club.name !== settingsInput.name
    ) {
        throw new Error('Club settings did not persist or replay idempotently.');
    }
    await management
        .updateSettings(principal(ids.moderator), ids.club, {
            ...settingsInput,
            operationId: randomUUID(),
        })
        .then(
            () => {
                throw new Error('A Moderator changed Admin-only Club settings.');
            },
            (error: unknown) => {
                if (!(error instanceof ClubAuthorizationError)) {
                    throw error;
                }
            },
        );
    await management
        .updateSettings(principal(ids.appAdmin), ids.club, {
            ...settingsInput,
            operationId: randomUUID(),
        })
        .then(
            () => {
                throw new Error('An App Admin without Membership changed Club settings.');
            },
            (error: unknown) => {
                if (!(error instanceof ClubAuthorizationError)) {
                    throw error;
                }
            },
        );
    await management
        .delete(principal(ids.admin), ids.club, {
            operationId: randomUUID(),
            confirmation: settingsInput.name,
        })
        .then(
            () => {
                throw new Error('A Club with Session history was deleted.');
            },
            (error: unknown) => {
                if (!(error instanceof ClubConflictError)) {
                    throw error;
                }
            },
        );

    const avatarOperationId = randomUUID();
    const avatar = await management.putAvatar(
        principal(ids.admin),
        ids.club,
        avatarOperationId,
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]),
        'image/png',
    );
    if (!avatar.changed || !avatar.hasAvatar || storedAvatarCount() !== 1) {
        throw new Error(
            'Club avatar storage/reference update did not complete atomically enough for recovery.',
        );
    }
    const removedAvatar = await management.removeAvatar(principal(ids.admin), ids.club, {
        operationId: randomUUID(),
    });
    if (!removedAvatar.changed || removedAvatar.hasAvatar || storedAvatarCount() !== 0) {
        throw new Error('Club avatar removal did not clear its reference and private object.');
    }

    const archiveOperationId = randomUUID();
    const archived = await management.changeLifecycle(principal(ids.admin), ids.club, 'archive', {
        operationId: archiveOperationId,
        confirmation: 'ARCHIVE',
    });
    const archiveRetry = await management.changeLifecycle(
        principal(ids.admin),
        ids.club,
        'archive',
        {
            operationId: archiveOperationId,
            confirmation: 'ARCHIVE',
        },
    );
    if (!archived.changed || archived.replayed || !archiveRetry.replayed) {
        throw new Error('Club archival did not return a stable idempotent receipt.');
    }
    await management
        .putAvatar(
            principal(ids.admin),
            ids.club,
            avatarOperationId,
            Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1]),
            'image/png',
        )
        .then(
            () => {
                throw new Error(
                    'An archived Club accepted avatar payload drift for a replayed operation.',
                );
            },
            (error: unknown) => {
                if (!(error instanceof ClubConflictError)) {
                    throw error;
                }
            },
        );
    const avatarRetryAfterArchive = await management.putAvatar(
        principal(ids.admin),
        ids.club,
        avatarOperationId,
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]),
        'image/png',
    );
    if (
        !avatarRetryAfterArchive.replayed ||
        avatarRetryAfterArchive.hasAvatar ||
        storedAvatarCount() !== 0
    ) {
        throw new Error(
            'An archived Club avatar retry did not return its receipt without rewriting storage.',
        );
    }
    await management.changeLifecycle(principal(ids.admin), ids.club, 'reactivate', {
        operationId: randomUUID(),
    });

    const adminCount = await database.membership.count({
        where: { clubId: ids.club, role: 'ADMIN', status: 'ACTIVE' },
    });
    if (adminCount !== 1) {
        throw new Error('The Club did not retain exactly one active Admin.');
    }
}
