import { checkClubCreation } from './club-check/creation.js';
import { checkLeaveAndDelete } from './club-check/departure.js';
import { seedClubFixtures } from './club-check/fixtures.js';
import { assertLogsExposeNoIdentifiers, cleanUpClubCheck } from './club-check/harness.js';
import { checkClubManagement } from './club-check/management.js';
import { checkPoliciesAndRoles } from './club-check/roles.js';

try {
    await seedClubFixtures();
    const { createdClub } = await checkClubCreation();
    await checkClubManagement();
    await checkPoliciesAndRoles();
    await checkLeaveAndDelete(createdClub);
    assertLogsExposeNoIdentifiers();

    console.log(
        'Club checks passed: transactional creation/reactivation limits, private role projections, adminless handling, audited settings/avatar changes, archive/reactivate, leave, empty-Club deletion tombstones, static tiers, serialized role changes, App Admin transfer, and idempotent receipts.',
    );
} finally {
    await cleanUpClubCheck();
}
