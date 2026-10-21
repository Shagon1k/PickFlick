import type { IClubAccess, IClubMember, IClubSettings, TClubRole } from '@pickflick/contracts';

const SETTINGS_CLUB_ID = '10000000-0000-4000-8000-000000000031';

export function settingsProjection(
    token: string | undefined,
    avatarVersion?: string,
    isMemberRemoved?: boolean,
): IClubSettings {
    let role: TClubRole =
        ROLES.find((name) => token?.split('-').includes(name.toLowerCase())) ?? 'ADMIN';
    const lifecycle = token?.includes('archived') ? 'ARCHIVED' : 'ACTIVE';
    if (token?.includes('adminless')) role = 'MODERATOR';
    const isAdmin = role === 'ADMIN';
    const isAdminless = token?.includes('adminless') ?? false;
    const isOverLimit = token?.includes('over-limit') ?? false;
    const isActive = lifecycle === 'ACTIVE';
    const isNewWorkAllowed = isActive && !isAdminless && !isOverLimit;
    return {
        currentMembershipId: (
            {
                ADMIN: '20000000-0000-4000-8000-000000000031',
                MEMBER: '20000000-0000-4000-8000-000000000032',
                MODERATOR: '20000000-0000-4000-8000-000000000033',
            } satisfies Record<TClubRole, string>
        )[role],
        access: {
            adminless: isAdminless,
            newWorkAllowed: isNewWorkAllowed,
            reasons: [
                ...(isActive ? [] : (['ARCHIVED'] as const)),
                ...(isAdminless ? (['ADMINLESS'] as const) : []),
                ...(isOverLimit ? (['MEMBER_LIMIT'] as const) : []),
            ] satisfies IClubAccess['reasons'],
        },
        club: {
            id: SETTINGS_CLUB_ID,
            name: 'Midnight Society',
            createdAt: '2025-01-01T00:00:00.000Z',
            description: 'Noir, classics, and arguments.',
            hasAvatar: Boolean(avatarVersion),
            ...(avatarVersion ? { avatarVersion } : {}),
            lifecycle,
            membershipRole: role,
            selectionScaleMin: 0,
            selectionScaleMax: 7,
            tier: 'FREE',
        },
        permissions: {
            viewClub: true,
            participate: isActive,
            leaveClub: !isAdmin,
            manageSessions: isNewWorkAllowed && role !== 'MEMBER',
            createInvitations: isNewWorkAllowed && role !== 'MEMBER',
            manageMembers: isActive && role !== 'MEMBER',
            manageRoles: isActive && isAdmin,
            manageSettings: isActive && isAdmin,
            manageLifecycle: isAdmin,
            viewAudit: isAdmin,
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
        members: memberRoster(role, isAdminless, isOverLimit, isMemberRemoved).map((member) => ({
            ...member,
            canRemove:
                isActive &&
                role !== 'MEMBER' &&
                member.role !== 'ADMIN' &&
                member.role !== role &&
                (isAdmin || member.role === 'MEMBER'),
        })),
        auditEvents: isAdmin
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

const ROLES = ['MEMBER', 'MODERATOR'] as const;

function memberRoster(
    role: TClubRole,
    isAdminless: boolean,
    isOverLimit: boolean,
    isMemberRemoved: boolean | undefined,
): Omit<IClubMember, 'canRemove'>[] {
    const members: Omit<IClubMember, 'canRemove'>[] = [
        {
            id: '20000000-0000-4000-8000-000000000031',
            displayName: 'Avery Admin',
            role: 'ADMIN',
            sessionCount: 0,
            joinedAt: '2026-01-01T00:00:00.000Z',
        },
        {
            id: '20000000-0000-4000-8000-000000000032',
            displayName: 'Morgan Member',
            role: 'MEMBER',
            sessionCount: 0,
            joinedAt: '2026-02-01T00:00:00.000Z',
        },
        ...(role === 'MODERATOR'
            ? [
                  {
                      id: '20000000-0000-4000-8000-000000000033',
                      displayName: 'Taylor Moderator',
                      role: 'MODERATOR' as const,
                      sessionCount: 0,
                      joinedAt: '2026-02-02T00:00:00.000Z',
                  },
              ]
            : []),
        ...(isOverLimit
            ? Array.from({ length: 7 }, (_, index) => ({
                  id: `20000000-0000-4000-8000-00000000004${index}`,
                  displayName: `Club member ${index + 1}`,
                  role: 'MEMBER' as const,
                  sessionCount: 0,
                  joinedAt: '2026-02-02T00:00:00.000Z',
              }))
            : []),
    ];
    return members.filter(
        (member) =>
            (!isAdminless || member.role !== 'ADMIN') &&
            (!isMemberRemoved || member.role !== 'MEMBER'),
    );
}
