import { changeRosterAction } from '../roster-actions';

const roster = vi.hoisted(() => ({
    joinSession: vi.fn(),
    leaveSession: vi.fn(),
    removeSessionParticipant: vi.fn(),
    revokeSessionInvitation: vi.fn(),
}));
const sessions = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('#api/session-roster.server', () => roster);
vi.mock('#api/sessions.server', () => sessions);
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const SESSION_ID = '20000000-0000-4000-8000-000000000001';
const PARTICIPANT_ID = '30000000-0000-4000-8000-000000000001';

describe('changeRosterAction', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        sessions.getSession.mockResolvedValue({ clubId: 'club' });
    });

    it.each([
        { action: 'kick' },
        { action: 'leave' },
        { action: 'remove', participantId: 'not-a-uuid', confirmation: 'REMOVE' },
        { action: 'join', participantId: PARTICIPANT_ID },
    ])('should reject the command %o without calling the API', async (input) => {
        await expect(changeRosterAction(SESSION_ID, input)).resolves.toEqual({
            ok: false,
            message: 'Check your selection and confirmation.',
        });
        expect(sessions.getSession).not.toHaveBeenCalled();
        expect(Object.values(roster).some((call) => call.mock.calls.length)).toBe(false);
    });

    it('should remove only the chosen participant', async () => {
        await expect(
            changeRosterAction(SESSION_ID, {
                action: 'remove',
                participantId: PARTICIPANT_ID,
                confirmation: 'REMOVE',
            }),
        ).resolves.toEqual({ ok: true, message: 'Roster updated.' });
        expect(roster.removeSessionParticipant).toHaveBeenCalledWith(SESSION_ID, PARTICIPANT_ID);
        expect(roster.leaveSession).not.toHaveBeenCalled();
    });
});
