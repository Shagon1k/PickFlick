const settingsClubId = '10000000-0000-4000-8000-000000000031';

const activeLifecycle = (lifecycle) => lifecycle === 'ACTIVE';

export function settingsProjection(token) {
    let role =
        ['member', 'moderator'].find((name) => token?.split('-').includes(name))?.toUpperCase() ??
        'ADMIN';
    const lifecycle = token?.includes('archived') ? 'ARCHIVED' : 'ACTIVE';
    if (token?.includes('adminless')) role = 'MODERATOR';
    const admin = role === 'ADMIN';
    const adminless = token?.includes('adminless') ?? false;
    const overLimit = token?.includes('over-limit') ?? false;
    const newWorkAllowed = activeLifecycle(lifecycle) && !adminless && !overLimit;
    const active = lifecycle === 'ACTIVE';
    return {
        currentMembershipId: {
            ADMIN: '20000000-0000-4000-8000-000000000031',
            MEMBER: '20000000-0000-4000-8000-000000000032',
            MODERATOR: '20000000-0000-4000-8000-000000000033',
        }[role],
        access: {
            adminless,
            newWorkAllowed,
            reasons: [
                ...(active ? [] : ['ARCHIVED']),
                ...(adminless ? ['ADMINLESS'] : []),
                ...(overLimit ? ['MEMBER_LIMIT'] : []),
            ],
        },
        club: {
            id: settingsClubId,
            name: 'Midnight Society',
            description: 'Noir, classics, and arguments.',
            hasAvatar: false,
            lifecycle,
            membershipRole: role,
            selectionScaleMin: 0,
            selectionScaleMax: 7,
            tier: 'FREE',
        },
        permissions: {
            viewClub: true,
            participate: active,
            leaveClub: !admin,
            manageSessions: newWorkAllowed && role !== 'MEMBER',
            createInvitations: newWorkAllowed && role !== 'MEMBER',
            manageMembers: active && role !== 'MEMBER',
            manageRoles: active && admin,
            manageSettings: active && admin,
            manageLifecycle: admin,
            viewAudit: admin,
        },
        entitlements: {
            tier: 'FREE',
            adminClubLimit: 1,
            memberLimit: 8,
            voteResultVisibility: 'ADMIN_HIDDEN',
        },
        visibility: {
            showNominationAuthors: true,
            showNominationsBeforeSubmit: true,
            showVoteResults: false,
            showRatingResults: true,
            useMonochromeMedia: true,
        },
        members: memberRoster(role, adminless, overLimit),
        auditEvents: admin
            ? [
                  {
                      id: '50000000-0000-4000-8000-000000000031',
                      action: 'CLUB_SETTINGS_UPDATED',
                      createdAt: '2026-09-18T12:00:00.000Z',
                  },
              ]
            : [],
    };
}

function memberRoster(role, adminless, overLimit) {
    return [
        {
            id: '20000000-0000-4000-8000-000000000031',
            displayName: 'Avery Admin',
            role: 'ADMIN',
            joinedAt: '2026-01-01T00:00:00.000Z',
        },
        {
            id: '20000000-0000-4000-8000-000000000032',
            displayName: 'Morgan Member',
            role: 'MEMBER',
            joinedAt: '2026-02-01T00:00:00.000Z',
        },
        ...(role === 'MODERATOR'
            ? [
                  {
                      id: '20000000-0000-4000-8000-000000000033',
                      displayName: 'Taylor Moderator',
                      role: 'MODERATOR',
                      joinedAt: '2026-02-02T00:00:00.000Z',
                  },
              ]
            : []),
        ...(overLimit
            ? Array.from({ length: 7 }, (_, index) => ({
                  id: `20000000-0000-4000-8000-00000000004${index}`,
                  displayName: `Club member ${index + 1}`,
                  role: 'MEMBER',
                  joinedAt: '2026-02-02T00:00:00.000Z',
              }))
            : []),
    ].filter((member) => !adminless || member.role !== 'ADMIN');
}
