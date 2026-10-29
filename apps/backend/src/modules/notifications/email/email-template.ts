import type { TNotificationEvent } from '@pickflick/contracts';

import { isMembershipEndedEvent } from '../notification-policy.js';
import { EMAIL_COPY } from './email-copy.js';

const ISO_DATE_LENGTH = 10;

const UNAVAILABLE_COPY = {
    subject: 'An update is no longer available',
    title: 'This update is no longer available.',
    body: 'Its target may have been removed, or your access may have changed. Open PickFlick to see your current updates.',
    category: 'Account update',
    action: '',
};

interface ITemplateInput {
    event: TNotificationEvent;
    href: string | null;
    createdAt: string;
    baseUrl: string;
}

function escapeHtml(value: string) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

/** Email-safe tables and inline styles preserve the owner-selected Card composition. */
export function renderNotificationEmail(input: ITemplateInput) {
    const isMandatory = input.event === 'BILLING_SERVICE';
    const copy =
        input.href || isMembershipEndedEvent(input.event)
            ? EMAIL_COPY[input.event]
            : UNAVAILABLE_COPY;
    const href = input.href && copy.action ? new URL(input.href, input.baseUrl).href : null;
    const settings = new URL('/settings?tab=notifications', input.baseUrl).href;
    const consent = isMandatory
        ? 'This is a required service notice about your account.'
        : 'You opted in to email updates for this event.';
    const date = new Date(input.createdAt).toISOString().slice(0, ISO_DATE_LENGTH);
    const subject = `${copy.subject} · PickFlick`;
    const text = [
        copy.title,
        copy.body,
        href ? `${copy.action}: ${href}` : '',
        consent,
        isMandatory ? '' : `Notification settings: ${settings}`,
        'Questions? hello@pick-flick.app',
    ]
        .filter(Boolean)
        .join('\n\n');
    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark"><title>${escapeHtml(subject)}</title>
<style>@media(max-width:575px){.shell{padding:24px 16px!important}.card{padding:28px 22px!important}h1{font-size:32px!important}}a:focus-visible{outline:2px solid #e8d8b8;outline-offset:4px}</style></head>
<body style="margin:0;background:#0c0c0c;color:#eee9e5;font:16px/1.55 Arial,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0c0c0c"><tr><td align="center">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px"><tr><td class="shell" style="padding:30px 24px">
<p style="margin:0 0 28px;text-align:center;font:24px Georgia,serif">PickFlick<span style="color:#c89b55">.</span></p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td class="card" style="padding:36px 32px;background:#161616;border:1px solid #2d2a27;border-radius:12px">
<p style="margin:0;color:#c89b55;font:12px/1.4 monospace;letter-spacing:1.4px;text-transform:uppercase">${escapeHtml(copy.category)}</p>
<h1 style="margin:18px 0;font:36px/1.12 Georgia,serif;letter-spacing:-.8px;color:#eee9e5">${escapeHtml(copy.title)}</h1>
<p style="margin:0 0 28px;color:#a6a19c">${escapeHtml(copy.body)}</p>
${href ? `<a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 22px;border:1px solid #eee9e5;border-radius:8px;background:#eee9e5;color:#0c0c0c;font:14px/1.3 Arial,sans-serif;text-decoration:none">${escapeHtml(copy.action)}</a>` : ''}
<p style="padding-top:24px;margin:28px 0 0;border-top:1px solid #2d2a27;color:#a6a19c;font:12px/1.4 monospace">${date} · PICKFLICK</p>
</td></tr></table>
<div style="margin-top:24px;padding:0 16px;text-align:center;color:#a6a19c;font:12px/1.6 Arial,sans-serif">
<p>${consent}</p>${isMandatory ? '' : `<a href="${escapeHtml(settings)}" style="display:inline-block;padding:14px 0;color:#a6a19c">Notification settings</a>`}
<p>Questions? hello@pick-flick.app</p>
</div></td></tr></table></td></tr></table></body></html>`;
    return { subject, text, html };
}
