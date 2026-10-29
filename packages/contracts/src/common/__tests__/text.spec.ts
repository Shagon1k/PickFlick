import { multilineText, singleLineText } from '../text.js';

describe('user text', () => {
    const name = singleLineText(1, 100);
    const notes = multilineText(0, 100);

    it.each(['A B', 'A B', 'A\u0085B', 'A\nB'])(
        'should keep single-line text on one line: %j',
        (value) => {
            expect(name.safeParse(value).success).toBe(false);
        },
    );

    it('should reject C1 control characters but keep tabs and newlines in notes', () => {
        expect(notes.safeParse('A\u009BB').success).toBe(false);
        expect(notes.safeParse('A\tB\nC').success).toBe(true);
    });
});
