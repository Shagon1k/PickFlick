import type { TPastSessionMembers } from '@pickflick/contracts';

type TPastMember = TPastSessionMembers[number];

/** A member's name as the import form shows it; departed members stay selectable as history. */
export function formatMemberName(member: TPastMember): string {
    return member.status === 'ACTIVE'
        ? member.displayName
        : `${member.displayName} (former member)`;
}

/** Display names by Membership ID, so rows can name an attendee without searching the list. */
export function buildMemberNames(members: TPastSessionMembers): Map<string, string> {
    return new Map(members.map((member) => [member.id, member.displayName]));
}
