import assert from 'node:assert/strict';

import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, test } from '@playwright/test';

import { settle } from './settle';

const PREVIEW_PATH = '/ui-preview';

async function assertVisibleFocus(locator: Locator, label: string) {
    const focusStyle = await locator.evaluate((element) => {
        const style = element.ownerDocument.defaultView?.getComputedStyle(element);
        return {
            boxShadow: style?.boxShadow,
            focusVisible: element.matches(':focus-visible'),
            outlineStyle: style?.outlineStyle,
            outlineWidth: style?.outlineWidth,
        };
    });
    assert.equal(focusStyle.focusVisible, true, `${label} must match :focus-visible`);
    assert.ok(
        (focusStyle.outlineStyle !== 'none' && focusStyle.outlineWidth !== '0px') ||
            focusStyle.boxShadow !== 'none',
        `${label} must render a visible focus treatment`,
    );
}

async function waitForAnimations(locator: Locator) {
    await locator.evaluate(async (element) => {
        await Promise.all(
            element
                .getAnimations({ subtree: true })
                .map((animation) => animation.finished.catch(() => undefined)),
        );
    });
}

test.setTimeout(75_000);

test('component gallery passes accessibility, form, keyboard, overlay, and motion checks', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    const browserErrors: string[] = [];
    page.on('console', (message) => {
        if (message.type() === 'error') {
            browserErrors.push(message.text());
        }
    });
    page.on('pageerror', (error) => browserErrors.push(error.message));

    await page.goto(PREVIEW_PATH, { waitUntil: 'load' });
    await settle(page);
    await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', 'dark');

    const accessibilityResults = await new AxeBuilder({ page }).analyze();
    assert.equal(
        accessibilityResults.violations.length,
        0,
        `accessibility violations:\n${accessibilityResults.violations
            .map(
                (violation) =>
                    `${violation.id} (${violation.impact ?? 'unknown impact'}): ${violation.help}\n${violation.nodes
                        .map(
                            (node) =>
                                `  ${node.target.join(' ')}: ${node.failureSummary ?? node.html}`,
                        )
                        .join('\n')}`,
            )
            .join('\n')}`,
    );

    const namedField = page.getByRole('textbox', { name: 'Club name', exact: true });
    await expect(namedField).toHaveAttribute('aria-describedby', 'club-name-description');
    await expect(page.locator('#club-name-description')).toHaveText('Shown to every Club member.');
    const reminderToggle = page.getByRole('switch', { name: 'Rating reminders', exact: true });
    await expect(reminderToggle).toHaveAttribute(
        'aria-describedby',
        'rating-reminders-description',
    );
    const emptyMessage = page.locator('#session-note-description');
    await expect(emptyMessage).toBeAttached();
    assert.ok(
        (await emptyMessage.evaluate((element) => element.getBoundingClientRect().height)) > 0,
        'empty field message must reserve layout space',
    );

    const asyncField = page
        .locator('#async-club-name')
        .locator("xpath=ancestor::*[contains(@class, '__field')][1]");
    const errorAnnouncement = asyncField.locator('[data-field-live="error"]');
    const successAnnouncement = asyncField.locator('[data-field-live="success"]');
    await expect(errorAnnouncement).toBeAttached();
    await expect(successAnnouncement).toBeAttached();
    await expect(errorAnnouncement).toBeEmpty();
    await expect(successAnnouncement).toBeEmpty();
    await page.getByRole('button', { name: 'Show async error' }).click();
    await expect(page.locator('#async-club-name-description')).toHaveText(
        'Club name could not be saved.',
    );
    await expect(errorAnnouncement).toHaveText('Club name could not be saved.');
    await expect(successAnnouncement).toBeEmpty();
    await page.getByRole('button', { name: 'Show async success' }).click();
    await expect(page.locator('#async-club-name-description')).toHaveText('Club name saved.');
    await expect(errorAnnouncement).toBeEmpty();
    await expect(successAnnouncement).toHaveText('Club name saved.');

    const select = page.getByRole('combobox', { name: 'Selection range', exact: true });
    await expect(select).toHaveAttribute('aria-describedby', 'score-range-description');
    await expect(page.locator('#score-range-description')).toHaveText(
        'Choose the Club scoring range.',
    );
    await select.focus();
    await page.keyboard.press('Enter');
    await assertVisibleFocus(select, 'select');
    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible();
    await waitForAnimations(listbox);
    // Mantine seeds its keyboard position shortly after opening; arrow until the next range is highlighted.
    await expect(async () => {
        await page.keyboard.press('ArrowDown');
        await expect(listbox.locator('[data-combobox-selected]')).toHaveText('1 to 5', {
            timeout: 250,
        });
    }).toPass({ timeout: 5_000 });
    await page.keyboard.press('Enter');
    await expect(select).toHaveValue('1 to 5');
    await expect(page.locator('input[type="hidden"][name="score-range"]')).toHaveValue('1-5');

    await expect(page.locator('button[data-state="success"] + [role="status"]')).toHaveText(
        'Changes saved.',
    );

    const submittedScale = page.locator('[data-submitted="true"]');
    await expect(submittedScale).toContainText('Submitted');
    await expect(submittedScale).toContainText('3 of 5');
    await expect(page.getByRole('radiogroup', { name: 'Submitted score' })).toHaveCount(0);

    const requiredForm = page.getByRole('form', { name: 'Required select form' });
    const requiredSelect = page.getByRole('combobox', { name: 'Required selection range' });
    const constraintInput = requiredForm.locator('input[name="required-range"]');
    await expect(constraintInput).toHaveAttribute('type', 'text');
    await expect(constraintInput).toHaveAttribute('required', '');
    await requiredForm.getByRole('button', { name: 'Submit required select' }).click();
    await expect(requiredForm.locator('[data-submitted-value]')).toHaveText('Not submitted');
    await expect(requiredSelect).toBeFocused();
    await expect(requiredSelect).toHaveAttribute('aria-invalid', 'true');
    assert.equal(await constraintInput.evaluate((element) => element.matches(':invalid')), true);
    await requiredSelect.click();
    // Scope to this select's own listbox: another Select's dropdown can still be closing on the page.
    await expect(requiredSelect).toHaveAttribute('aria-expanded', 'true');
    const requiredListbox = page.locator(
        `[id="${await requiredSelect.getAttribute('aria-controls')}"]`,
    );
    await expect(requiredListbox).toBeVisible();
    await waitForAnimations(requiredListbox);
    await requiredListbox.getByRole('option', { name: '0 to 4' }).click();
    // Submitting before the constraint input receives the value is blocked by native required validation.
    await expect(constraintInput).toHaveValue('0-4');
    await requiredForm.getByRole('button', { name: 'Submit required select' }).click();
    await expect(requiredForm.locator('[data-submitted-value]')).toHaveText('0-4');
    assert.equal(await constraintInput.evaluate((element) => element.matches(':valid')), true);

    const readOnlyForm = page.getByRole('form', { name: 'Read-only required select form' });
    const readOnlySelect = page.getByRole('combobox', { name: 'Read-only selection range' });
    const readOnlyInput = readOnlyForm.locator('input[name="read-only-range"]');
    await expect(readOnlySelect).not.toHaveAttribute('required', '');
    await expect(readOnlyInput).toHaveAttribute('type', 'hidden');
    await expect(readOnlyInput).not.toHaveAttribute('required', '');
    await readOnlyForm.getByRole('button', { name: 'Submit read-only select' }).click();
    await expect(readOnlyForm.locator('[data-read-only-submitted]')).toHaveText('Submitted');

    const overviewTab = page.getByRole('tab', { name: 'Overview' });
    const sessionsTab = page.getByRole('tab', { name: 'Sessions' });
    await overviewTab.focus();
    await page.keyboard.press('ArrowRight');
    await expect(sessionsTab).toBeFocused();
    await assertVisibleFocus(sessionsTab, 'tab');
    await expect(overviewTab).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    await expect(sessionsTab).toHaveAttribute('aria-selected', 'true');

    const changingTabs = page.getByRole('tablist', { name: 'Changing views' });
    const firstChangingTab = changingTabs.getByRole('tab', { name: 'First enabled' });
    const selectedChangingTab = changingTabs.getByRole('tab', { name: 'Selected tab' });
    await expect(selectedChangingTab).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('button', { name: 'Disable selected tab' }).click();
    await expect(selectedChangingTab).toBeDisabled();
    await expect(firstChangingTab).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('button', { name: 'Enable selected tab' }).click();
    await selectedChangingTab.click();
    await expect(selectedChangingTab).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('button', { name: 'Remove selected tab' }).click();
    await expect(selectedChangingTab).toHaveCount(0);
    await expect(firstChangingTab).toHaveAttribute('aria-selected', 'true');

    const clubTrigger = page.getByRole('button', { name: 'Open Club menu' });
    const accountTrigger = page.getByRole('button', { name: 'Open account menu' });
    await clubTrigger.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menu', { name: 'Club menu' })).toBeVisible();
    const firstClubMenuItem = page.getByRole('menuitem', { name: 'Overview' });
    await expect(firstClubMenuItem).toBeFocused();
    await assertVisibleFocus(firstClubMenuItem, 'menu item');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(accountTrigger).toBeFocused();
    await expect(page.getByRole('menu', { name: 'Club menu' })).toBeHidden();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menu', { name: 'Account menu' })).toBeVisible();
    await expect(page.getByRole('menu', { name: 'Club menu' })).toBeHidden();
    // Escape belongs to the open menu; pressing it before focus lands on an item races the opening.
    await expect(page.getByRole('menuitem', { name: 'Profile' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(accountTrigger).toBeFocused();

    await clubTrigger.click();
    const leaveClubAction = page.getByRole('menuitem', { name: 'Leave Club' });
    await waitForAnimations(page.getByRole('menu', { name: 'Club menu' }));
    assert.equal(await leaveClubAction.evaluate((element) => element.tagName), 'BUTTON');
    await leaveClubAction.click();
    await expect(page.locator('[data-menu-action]')).toHaveText('Leave Club selected');
    await expect(page.getByRole('menu', { name: 'Club menu' })).toBeHidden();

    const adjustableScale = page.getByRole('radiogroup', { name: 'Adjustable score' });
    const adjustableFieldset = adjustableScale.locator('xpath=ancestor::fieldset');
    await expect(adjustableFieldset.locator('output')).toHaveText('5 of 5');
    await page.getByRole('button', { name: 'Reduce adjustable scale' }).click();
    await expect(adjustableFieldset.locator('output')).toHaveText('Not selected');
    await expect(page.locator('input[type="hidden"][name="adjustable-score"]')).toHaveValue('');
    await expect(adjustableScale.locator('[aria-checked="true"]')).toHaveCount(0);
    const firstAdjustableOption = adjustableScale.getByRole('radio', { name: '1 of 4' });
    await firstAdjustableOption.focus();
    await expect(firstAdjustableOption).toHaveAttribute('data-active', 'true');
    await page.keyboard.press('Tab');
    await expect(firstAdjustableOption).not.toHaveAttribute('data-active', 'true');

    const requiredScoreForm = page.getByRole('form', { name: 'Required score form' });
    const requiredScore = requiredScoreForm.getByRole('radiogroup', {
        name: 'Required selection score',
    });
    const scoreConstraint = requiredScoreForm.locator('[data-scale-constraint]');
    await expect(scoreConstraint).toHaveAttribute('required', '');
    await requiredScoreForm.getByRole('button', { name: 'Submit required score' }).click();
    await expect(requiredScoreForm.locator('[data-submitted-score]')).toHaveText('Not submitted');
    await expect(requiredScore).toHaveAttribute('aria-invalid', 'true');
    await expect(requiredScore.getByRole('radio', { name: '0 of 4' })).toBeFocused();
    await expect(requiredScoreForm.locator('fieldset output')).toHaveText('Select a score.');
    assert.equal(await scoreConstraint.evaluate((element) => element.matches(':invalid')), true);
    await requiredScore.getByRole('radio', { name: '0 of 4' }).click();
    await requiredScoreForm.getByRole('button', { name: 'Submit required score' }).click();
    await expect(requiredScoreForm.locator('[data-submitted-score]')).toHaveText('0');
    await expect(requiredScore).not.toHaveAttribute('aria-invalid', 'true');
    assert.equal(await scoreConstraint.evaluate((element) => element.matches(':valid')), true);

    const dialogTrigger = page.getByRole('button', { name: 'Open dialog' });
    await dialogTrigger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Move to Selection?' });
    await expect(dialog).toBeVisible();
    const dialogClose = page.getByRole('button', { name: 'Close dialog' });
    await expect(dialogClose).toBeFocused();
    await assertVisibleFocus(dialogClose, 'dialog close button');
    for (let index = 0; index < 4; index += 1) {
        await page.keyboard.press('Tab');
        assert.equal(
            await dialog.evaluate((element) =>
                element.contains(element.ownerDocument.activeElement),
            ),
            true,
        );
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(dialogTrigger).toBeFocused();

    await clubTrigger.click();
    const targetLocators = [
        page.getByRole('tab', { name: 'Overview' }),
        page.getByRole('combobox', { name: 'Selection range', exact: true }),
        clubTrigger,
        page.getByRole('menuitem', { name: 'Overview' }),
        firstAdjustableOption,
    ];
    for (const locator of targetLocators) {
        assert.ok(
            (await locator.evaluate((element) => element.getBoundingClientRect().height)) >= 44,
            'interactive target must be at least 44px high',
        );
    }
    assert.equal(
        await select.evaluate(
            (element) =>
                element.ownerDocument.defaultView?.getComputedStyle(element).backgroundColor,
        ),
        // Controls sit one step darker (--bg) than the --surface that holds them.
        'rgb(12, 12, 12)',
    );
    assert.equal(
        await page
            .getByRole('menu', { name: 'Club menu' })
            .evaluate(
                (element) =>
                    element.ownerDocument.defaultView?.getComputedStyle(element).backgroundColor,
            ),
        'rgb(12, 12, 12)',
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(PREVIEW_PATH, { waitUntil: 'load' });
    await settle(page);
    await page.getByRole('button', { name: 'Open Club menu' }).click();
    const animationDuration = await page
        .getByRole('menu', { name: 'Club menu' })
        .evaluate((element) =>
            Number.parseFloat(
                element.ownerDocument.defaultView?.getComputedStyle(element).animationDuration ??
                    '0',
            ),
        );
    assert.ok(animationDuration <= 0.001, 'reduced motion must collapse menu animation duration');

    assert.deepEqual(browserErrors, [], `browser errors: ${browserErrors.join(' | ')}`);
});
