import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

function formatViolations(violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations']) {
    return violations
        .map(
            (violation) =>
                `${violation.id} (${violation.impact ?? 'unknown impact'}): ${violation.help}\n${violation.nodes
                    .map(
                        (node) => `  ${node.target.join(' ')}: ${node.failureSummary ?? node.html}`,
                    )
                    .join('\n')}`,
        )
        .join('\n');
}

for (const profile of [
    { height: 844, name: 'mobile', width: 390 },
    { height: 900, name: 'wide', width: 1440 },
] as const) {
    test(`has no automated accessibility violations at the ${profile.name} viewport`, async ({
        page,
    }, testInfo) => {
        await page.setViewportSize({ height: profile.height, width: profile.width });
        await page.goto('/ui-preview', { waitUntil: 'networkidle' });

        const results = await new AxeBuilder({ page }).analyze();
        await testInfo.attach(`axe-${profile.name}.json`, {
            body: Buffer.from(JSON.stringify(results, undefined, 2)),
            contentType: 'application/json',
        });

        expect(results.violations, formatViolations(results.violations)).toEqual([]);
    });
}

test('turns a controlled accessibility defect into actionable evidence', async ({ page }) => {
    await page.setContent('<main><button></button></main>');

    const results = await new AxeBuilder({ page }).analyze();
    const buttonNameViolation = results.violations.find(({ id }) => id === 'button-name');

    expect(buttonNameViolation).toBeDefined();
    expect(formatViolations(buttonNameViolation ? [buttonNameViolation] : [])).toMatch(
        /button-name[\s\S]*button/i,
    );
});
