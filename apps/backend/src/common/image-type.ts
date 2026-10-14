export type TImageType = 'image/png' | 'image/jpeg' | 'image/webp';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
// WebP is a RIFF container: "RIFF", a four-byte size, then "WEBP".
const RIFF_TAG = Buffer.from('RIFF', 'ascii');
const WEBP_TAG = Buffer.from('WEBP', 'ascii');
const WEBP_TAG_OFFSET = 8;

function startsWith(body: Buffer, signature: Buffer, offset = 0): boolean {
    return body.subarray(offset, offset + signature.length).equals(signature);
}

/** The image type the file's first bytes declare, whatever its name or header claims. */
export function detectImageType(body: Buffer): TImageType | undefined {
    if (startsWith(body, PNG_SIGNATURE)) return 'image/png';
    if (startsWith(body, JPEG_SIGNATURE)) return 'image/jpeg';
    if (startsWith(body, RIFF_TAG) && startsWith(body, WEBP_TAG, WEBP_TAG_OFFSET))
        return 'image/webp';
    return undefined;
}
