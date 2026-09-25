import { BadRequestException } from '@nestjs/common';

import { parseAvatarUpload } from '../club-avatar.service.js';

describe('parseAvatarUpload', () => {
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);

    it('should accept a PNG whose bytes match its type', () => {
        expect(parseAvatarUpload(png, 'image/png; charset=binary')).toMatchObject({
            mediaType: 'image/png',
            extension: 'png',
        });
    });

    it.each([
        [png, 'image/jpeg'],
        [png, 'image/gif'],
        [Buffer.alloc(0), 'image/png'],
        [Buffer.alloc(512 * 1024 + 1, 1), 'image/png'],
        ['not a buffer', 'image/png'],
    ])('should reject %#', (body, contentType) => {
        expect(() => parseAvatarUpload(body, contentType)).toThrow(BadRequestException);
    });
});
