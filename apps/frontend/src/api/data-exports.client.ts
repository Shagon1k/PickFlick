import { HTTP_STATUS } from '@pickflick/contracts';

// Binary downloads stay on the authenticated API path rather than passing through action payloads.
export async function downloadDataExport(url: string): Promise<string | null> {
    const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
    if (response.status === HTTP_STATUS.UNAUTHORIZED)
        return 'Your session has ended. Sign in again to download your archive.';
    if (response.status === HTTP_STATUS.NOT_FOUND)
        return 'The archive or download link has expired. Refresh its status and try again.';
    if (!response.ok)
        return 'The archive could not be downloaded. Refresh its status and try again.';
    const objectUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = 'pickflick-data.json.gz';
    link.click();
    URL.revokeObjectURL(objectUrl);
    return null;
}
