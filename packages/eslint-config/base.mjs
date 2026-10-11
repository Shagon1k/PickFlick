import eslint from '@eslint/js';
import reactPlugin from '@eslint-react/eslint-plugin';
import prettier from 'eslint-config-prettier';
import nextPlugin from '@next/eslint-plugin-next';
import vitest from '@vitest/eslint-plugin';
import checkFile from 'eslint-plugin-check-file';
import jsxA11y from 'eslint-plugin-jsx-a11y-x';
import playwright from 'eslint-plugin-playwright';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';
import { resolve } from 'node:path';
import tseslint from 'typescript-eslint';

const reactConfig = reactPlugin.configs['recommended-typescript'];
const repositoryRoot = resolve(import.meta.dirname, '../..');

const noReadonlyWrapper = {
    selector: "TSTypeReference[typeName.name='Readonly']",
    message: 'Write plain types; props and data are not wrapped in Readonly<>.',
};

export default [
    {
        // A disable directive that no longer suppresses anything fails the lint.
        linterOptions: { reportUnusedDisableDirectives: 'error' },
    },
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
    // Type-aware rules catch what syntax cannot: unawaited promises, async callbacks where a sync one
    // is expected, and non-exhaustive switches. Every TypeScript file must belong to a tsconfig.
    ...tseslint.configs.recommendedTypeChecked,
    {
        languageOptions: {
            parserOptions: { projectService: true, tsconfigRootDir: repositoryRoot },
        },
        rules: {
            // A default branch covers the remaining cases on purpose.
            '@typescript-eslint/switch-exhaustiveness-check': [
                'error',
                { considerDefaultExhaustiveForUnions: true },
            ],
            // React ignores a handler's returned promise; our async handlers catch their own errors.
            '@typescript-eslint/no-misused-promises': [
                'error',
                { checksVoidReturn: { attributes: false } },
            ],
            // Async implementations of promise-returning interfaces read better than Promise.resolve.
            '@typescript-eslint/require-await': 'off',
        },
    },
    {
        files: ['**/*.{js,mjs,cjs}'],
        ...tseslint.configs.disableTypeChecked,
    },
    // The rules SonarQube for IDE reports, so the editor, hooks, and CI agree.
    sonarjs.configs.recommended,
    {
        files: ['**/*.{js,mjs,ts,tsx}'],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
        rules: {
            curly: ['error', 'all'],
            // Props are plain types in this codebase (see .agent-docs/rules/typescript.md).
            'sonarjs/prefer-read-only-props': 'off',
            'no-duplicate-imports': 'error',
            // A file past 300 lines holds more than one idea; split it.
            'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
        },
    },
    {
        // A spec is a flat list of independent cases, so it gets more room before it must split.
        files: ['**/__tests__/**', 'tests/**'],
        rules: {
            'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
        },
    },
    {
        // House style from .agent-docs/rules/typescript.md, enforced so every agent writes alike.
        files: ['**/*.{ts,tsx}'],
        plugins: { 'check-file': checkFile, 'simple-import-sort': simpleImportSort },
        rules: {
            'simple-import-sort/imports': 'error',
            // Type-only imports are marked inline (`import { type IUser }`) so builds can drop them.
            '@typescript-eslint/consistent-type-imports': [
                'error',
                { fixStyle: 'inline-type-imports', prefer: 'type-imports' },
            ],
            'simple-import-sort/exports': 'error',
            '@typescript-eslint/naming-convention': [
                'error',
                { selector: 'interface', format: ['PascalCase'], prefix: ['I'] },
                { selector: 'typeAlias', format: ['PascalCase'], prefix: ['T'] },
            ],
            'no-restricted-syntax': ['error', noReadonlyWrapper],
            'check-file/filename-naming-convention': [
                'error',
                { '**/__tests__/**/*.{ts,tsx}': '*.?(int.)spec' },
                { ignoreMiddleExtensions: false },
            ],
        },
    },
    {
        files: ['apps/frontend/**/*.{ts,tsx}'],
        rules: {
            // Restating the rule replaces the shared entry, so the Readonly ban is listed again.
            'no-restricted-syntax': [
                'error',
                noReadonlyWrapper,
                {
                    selector: 'ExportNamedDeclaration > FunctionDeclaration[id.name=/^[A-Z]/]',
                    message:
                        'Export a component as the default export of its own file (export default function Name).',
                },
            ],
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: ['@mantine/*', '!@mantine/form'],
                            message: 'Use the UI kit in @/components/ui; only it imports Mantine.',
                        },
                        {
                            group: ['../../../*'],
                            message: 'Import through the @/ alias instead of a deep relative path.',
                        },
                    ],
                },
            ],
            // components/<group>/<Name>/<Name>.tsx: one PascalCase folder per component, inside a
            // group listed in ignoreWords (the rule would otherwise check the group name too).
            'check-file/folder-naming-convention': [
                'error',
                {
                    'apps/frontend/src/components/*/': 'KEBAB_CASE',
                    'apps/frontend/src/components/*/!(__tests__)/': 'PASCAL_CASE',
                },
                { ignoreWords: ['clubs', 'navigation', 'sessions', 'shells', 'ui'] },
            ],
        },
    },
    {
        // Nest injects constructor parameters by their emitted class metadata, so those imports
        // are values; the parser must know to keep consistent-type-imports from rewriting them.
        files: ['apps/backend/**/*.ts'],
        languageOptions: {
            parserOptions: { emitDecoratorMetadata: true, experimentalDecorators: true },
        },
    },
    {
        // Static accessibility checks; axe in the Playwright suite covers the rendered result.
        files: ['apps/frontend/**/*.tsx'],
        plugins: jsxA11y.configs.strict.plugins,
        rules: {
            ...jsxA11y.configs.strict.rules,
            // Strict counts every handler; focus and hover delegation on a container (close when
            // focus leaves, preview on hover) is not an interaction, so only activation counts.
            'jsx-a11y-x/no-static-element-interactions': [
                'error',
                {
                    handlers: [
                        'onClick',
                        'onMouseDown',
                        'onMouseUp',
                        'onKeyPress',
                        'onKeyDown',
                        'onKeyUp',
                    ],
                },
            ],
            // A scrollable region must take focus so keyboard users can scroll it (axe
            // scrollable-region-focusable).
            'jsx-a11y-x/no-noninteractive-tabindex': ['error', { roles: ['region', 'tabpanel'] }],
        },
    },
    {
        // The UI kit and theme own Mantine; tests may reach files outside src such as next.config.
        files: [
            'apps/frontend/src/components/ui/**',
            'apps/frontend/src/theme/**',
            'apps/frontend/**/__tests__/**',
        ],
        rules: { 'no-restricted-imports': 'off' },
    },
    {
        files: ['apps/frontend/**/*.{ts,tsx}'],
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
    {
        rules: {
            // exactOptionalPropertyTypes needs `?: T | undefined` to accept an explicit undefined.
            'sonarjs/no-redundant-optional': 'off',
        },
    },
    {
        // Tests and local tooling talk to loopback and synthetic hosts over plain HTTP.
        files: ['**/__tests__/**', 'tests/**', 'scripts/**'],
        rules: {
            'sonarjs/no-clear-text-protocols': 'off',
            'sonarjs/no-hardcoded-ip': 'off',
        },
    },
    {
        // Next.js's own rules: next/link for internal navigation, no sync scripts, and the like.
        files: ['apps/frontend/**/*.{ts,tsx}'],
        plugins: { '@next/next': nextPlugin },
        settings: { next: { rootDir: 'apps/frontend' } },
        rules: nextPlugin.configs['core-web-vitals'].rules,
    },
    {
        files: ['**/__tests__/**/*.{ts,tsx}'],
        plugins: { vitest },
        rules: {
            ...vitest.configs.recommended.rules,
            // Helpers named expect* (expectConstraint, expectAccepted) assert on the test's behalf.
            'vitest/expect-expect': ['error', { assertFunctionNames: ['expect*'] }],
            // vitest/unbound-method understands `expect(mock.method)`; the TypeScript rule does not.
            '@typescript-eslint/unbound-method': 'off',
            'vitest/unbound-method': 'error',
            // Vitest types asymmetric matchers such as expect.stringContaining as `any`.
            '@typescript-eslint/no-unsafe-assignment': 'off',
        },
    },
    {
        files: ['tests/**/*.ts'],
        ...playwright.configs['flat/recommended'],
    },
    {
        // Developer and CI tooling deliberately resolves pnpm, docker, and git from PATH.
        files: ['scripts/**', 'packages/database/src/cli/**'],
        rules: {
            'sonarjs/no-os-command-from-path': 'off',
        },
    },
    // Disables formatting rules that Prettier owns; always last.
    prettier,
];
