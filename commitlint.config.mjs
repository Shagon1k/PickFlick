/** @type {import('@commitlint/types').UserConfig} */
export default {
    extends: ['@commitlint/config-conventional'],
    rules: {
        // Header max 72 chars
        'header-max-length': [2, 'always', 72],

        // Allowed types
        'type-enum': [
            2,
            'always',
            ['feat', 'fix', 'chore', 'docs', 'refactor', 'test', 'perf', 'build', 'ci', 'style'],
        ],

        // Scope is optional
        'scope-empty': [0],

        // Body and footer lines capped at 100 chars
        'body-max-line-length': [2, 'always', 100],
        'footer-max-line-length': [2, 'always', 100],
    },
};
