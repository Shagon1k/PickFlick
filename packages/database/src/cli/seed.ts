import { loadDatabaseEnvironment } from '@pickflick/config/environment';

import { createDatabaseClient } from '../client.js';
import { SYNTHETIC_FIXTURES } from '../fixtures.js';
import { assertSafeSeedOrResetTarget } from '../safety.js';

const environment = loadDatabaseEnvironment();
assertSafeSeedOrResetTarget(environment);
const database = createDatabaseClient(environment.databaseUrl);

try {
    await database.$transaction(async (transaction) => {
        for (const user of SYNTHETIC_FIXTURES.users) {
            await transaction.user.upsert({
                where: { id: user.id },
                create: user,
                update: {
                    email: user.email,
                    displayName: user.displayName,
                    appRole: 'USER',
                    status: 'ACTIVE',
                    locale: 'en',
                },
            });
        }

        await transaction.club.upsert({
            where: { id: SYNTHETIC_FIXTURES.club.id },
            create: SYNTHETIC_FIXTURES.club,
            update: {
                name: SYNTHETIC_FIXTURES.club.name,
                lifecycle: 'ACTIVE',
                selectionScaleMin: 1,
                selectionScaleMax: 5,
            },
        });
        await transaction.membership.upsert({
            where: { id: SYNTHETIC_FIXTURES.memberships.admin },
            create: {
                id: SYNTHETIC_FIXTURES.memberships.admin,
                clubId: SYNTHETIC_FIXTURES.club.id,
                userId: SYNTHETIC_FIXTURES.users[0].id,
                role: 'ADMIN',
            },
            update: {
                clubId: SYNTHETIC_FIXTURES.club.id,
                userId: SYNTHETIC_FIXTURES.users[0].id,
                role: 'ADMIN',
                status: 'ACTIVE',
                leftAt: null,
            },
        });
        await transaction.membership.upsert({
            where: { id: SYNTHETIC_FIXTURES.memberships.member },
            create: {
                id: SYNTHETIC_FIXTURES.memberships.member,
                clubId: SYNTHETIC_FIXTURES.club.id,
                userId: SYNTHETIC_FIXTURES.users[1].id,
            },
            update: {
                clubId: SYNTHETIC_FIXTURES.club.id,
                userId: SYNTHETIC_FIXTURES.users[1].id,
                role: 'MEMBER',
                status: 'ACTIVE',
                leftAt: null,
            },
        });
        await transaction.session.upsert({
            where: { id: SYNTHETIC_FIXTURES.pastSession.id },
            create: {
                id: SYNTHETIC_FIXTURES.pastSession.id,
                clubId: SYNTHETIC_FIXTURES.club.id,
                type: 'PAST',
                phase: 'COMPLETED',
                topic: SYNTHETIC_FIXTURES.pastSession.topic,
            },
            update: {
                clubId: SYNTHETIC_FIXTURES.club.id,
                type: 'PAST',
                phase: 'COMPLETED',
                topic: SYNTHETIC_FIXTURES.pastSession.topic,
                phaseVersion: 1,
            },
        });
    });
    console.log(
        'Synthetic local/test seed applied idempotently (2 users, 1 club, 2 memberships, 1 Past Session).',
    );
} finally {
    await database.$disconnect();
}
