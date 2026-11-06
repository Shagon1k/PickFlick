import type AxeBuilder from '@axe-core/playwright';

/** Readable axe output for an assertion message: rule, impact, help and each failing node. */
export function formatViolations(
    violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations'],
) {
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
