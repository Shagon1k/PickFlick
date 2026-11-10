import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

import { parseAvatarUpload } from '../clubs/club-avatar.service.js';

const MAX_INPUT_PIXELS = 4096 * 4096;
const AVATAR_DIMENSION_PX = 512;

/** Fresh encoding drops source metadata and trailing payload before private storage. */
export async function parseAccountAvatar(body: unknown, contentType?: string): Promise<Buffer> {
    const upload = parseAvatarUpload(body, contentType);
    try {
        return await sharp(upload.body, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'warning' })
            .rotate()
            .resize({
                width: AVATAR_DIMENSION_PX,
                height: AVATAR_DIMENSION_PX,
                fit: 'inside',
                withoutEnlargement: true,
            })
            .webp()
            .toBuffer();
    } catch {
        throw new BadRequestException({ reason: 'INVALID_AVATAR_CONTENT' });
    }
}
