import { expect, type Page } from '@playwright/test';

/** The Session Details facts row that names accepted participants. */
export function acceptedParticipants(page: Page) {
    return page
        .getByRole('region', { name: 'Session details', exact: true })
        .locator('dt', { hasText: 'Participants' })
        .locator('xpath=following-sibling::dd[1]');
}

/** The phase capsule overlays the poster on phones and sits inline on desktop: check the shown one. */
export async function expectSessionPhase(page: Page, label: string) {
    await expect(
        page.getByText(label, { exact: true }).filter({ visible: true }).first(),
    ).toBeVisible();
}
