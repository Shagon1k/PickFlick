import eslint from '@eslint/js';
import reactPlugin from '@eslint-react/eslint-plugin';
import prettier from 'eslint-config-prettier';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const reactConfig = reactPlugin.configs['recommended-typescript'];

export default [
    {
        ignores: [
            '**/.next/**',
            '**/coverage/**',
            '**/dist/**',
            '**/generated/**',
            '**/node_modules/**',
            '**/test-results/**',
        ],
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['**/*.{js,mjs,ts,tsx}'],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
        rules: {
            curly: ['error', 'all'],
            'no-duplicate-imports': 'error',
            // Soft guard against god-files: a signal to decompose, not a hard block.
            'max-lines': ['warn', { max: 500, skipBlankLines: true, skipComments: true }],
        },
    },
    {
        files: ['apps/web/**/*.{ts,tsx}', 'packages/ui/**/*.{ts,tsx}'],
        ...reactConfig,
        languageOptions: {
            ...reactConfig.languageOptions,
            globals: {
                ...globals.browser,
            },
        },
        plugins: {
            ...reactConfig.plugins,
            'react-hooks': reactHooksPlugin,
        },
        rules: {
            ...reactConfig.rules,
            ...reactHooksPlugin.configs.recommended.rules,
        },
    },
    // Disables formatting rules that Prettier owns; always last.
    prettier,
];
