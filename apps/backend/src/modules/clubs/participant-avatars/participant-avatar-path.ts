/** The public URL of the avatar route in participant-avatar.controller.ts. */
export function getParticipantAvatarPath(clubId: string, sessionId: string, participantId: string) {
    return `/api/clubs/${clubId}/sessions/${sessionId}/participants/${participantId}/avatar`;
}
