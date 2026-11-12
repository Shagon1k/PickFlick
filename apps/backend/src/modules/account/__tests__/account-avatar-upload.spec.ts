import sharp from 'sharp';

import { parseAccountAvatar } from '../account-avatar-upload.js';

describe('parseAccountAvatar', () => {
    it.each(['png', 'jpeg', 'webp'] as const)(
        'should decode %s content and store a bounded WebP',
        async (format) => {
            const image = await sharp({
                create: { width: 800, height: 400, channels: 3, background: 'red' },
            })
                .toFormat(format)
                .toBuffer();
            const output = await parseAccountAvatar(image, `image/${format}`);
            const metadata = await sharp(output).metadata();
            expect(metadata).toMatchObject({ format: 'webp', width: 512, height: 256 });
        },
    );

    it('should apply orientation and remove source metadata', async () => {
        const image = await sharp({
            create: { width: 30, height: 20, channels: 3, background: 'red' },
        })
            .jpeg()
            .withMetadata({ orientation: 6 })
            .toBuffer();
        const output = await parseAccountAvatar(image, 'image/jpeg');
        const metadata = await sharp(output).metadata();
        expect(metadata).toMatchObject({ width: 20, height: 30, format: 'webp' });
        expect(metadata.exif).toBeUndefined();
        expect(metadata.icc).toBeUndefined();
        expect(metadata.orientation).toBeUndefined();
    });

    it('should reject a signature without valid image content and a mismatched MIME', async () => {
        const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 1]);
        await expect(parseAccountAvatar(signature, 'image/png')).rejects.toThrow();
        const image = await sharp({
            create: { width: 1, height: 1, channels: 3, background: 'red' },
        })
            .png()
            .toBuffer();
        await expect(parseAccountAvatar(image, 'image/jpeg')).rejects.toThrow();
    });

    it('should reject compressed images that exceed the decoded pixel budget', async () => {
        const image = await sharp({
            create: { width: 4097, height: 4097, channels: 3, background: 'white' },
        })
            .png()
            .toBuffer();
        await expect(parseAccountAvatar(image, 'image/png')).rejects.toThrow();
    });
});
