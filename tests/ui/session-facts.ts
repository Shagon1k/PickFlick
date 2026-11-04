import type { Page } from '@playwright/test';

/** The Session Details facts row that names accepted participants. */
export function acceptedParticipants(page: Page) {
    return page
        .getByRole('region', { name: 'Session details', exact: true })
        .locator('dt', { hasText: 'Participants' })
        .locator('xpath=following-sibling::dd[1]');
}
