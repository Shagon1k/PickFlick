import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { NOTIFICATION_EVENTS } from '../packages/contracts/dist/index.js';
import { renderNotificationEmail } from '../apps/backend/dist/modules/notifications/email/email-template.js';

const directory = await mkdtemp(join(tmpdir(), 'pickflick-email-preview-'));
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const isDirty = Boolean(
    execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
);
const links = [];
function buildPreviewHref(event) {
    const id = '00000000-0000-4000-8000-000000000001';
    if (event === 'BILLING_SERVICE') return '/settings';
    if (event === 'ACHIEVEMENT_EARNED') return '/library?tab=achievements';
    if (event.startsWith('MEMBERSHIP_') || event.startsWith('CLUB_')) return `/clubs/${id}`;
    return `/sessions/${id}`;
}

for (const event of NOTIFICATION_EVENTS) {
    for (const state of ['available', 'unavailable']) {
        const filename = `${event.toLowerCase()}-${state}.html`;
        const email = renderNotificationEmail({
            event,
            href: state === 'available' ? buildPreviewHref(event) : null,
            createdAt: '2026-10-28T12:00:00Z',
            baseUrl: 'https://uat.pick-flick.app',
        });
        await writeFile(resolve(directory, filename), email.html);
        await writeFile(
            resolve(directory, filename.replace('.html', '.txt')),
            `${email.subject}\n\n${email.text}\n`,
        );
        links.push(`<li><a href="${filename}">${event} · ${state}</a></li>`);
    }
}
await writeFile(
    resolve(directory, 'index.html'),
    `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PickFlick email catalog</title></head>
<body><h1>PickFlick email catalog</h1><p>${revision}${isDirty ? ' + uncommitted working tree' : ''}</p>
<p>Synthetic previews. This catalog sends no email. Inactivity and billing producers remain reserved.</p><ul>${links.join('')}</ul></body></html>`,
);
process.stdout.write(`Email catalog: ${resolve(directory, 'index.html')}\n`);
