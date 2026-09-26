/** @type {import('stylelint').Config} */
export default {
    // recess-order groups declarations (position, box model, typography, visuals, motion), so every
    // file reads in the same order whoever wrote it; `stylelint --fix` applies it.
    extends: ['stylelint-config-standard-scss', 'stylelint-config-recess-order'],
    // A disable must name its reason and still be needed.
    reportDescriptionlessDisables: true,
    reportInvalidScopeDisables: true,
    reportNeedlessDisables: true,
    rules: {
        'declaration-no-important': true,
        'selector-max-id': 0,
        // Class names follow .agent-docs/rules/frontend-css.md: `.componentName`,
        // `.componentName__element-name`, and `.m-modifier`, which may repeat a kebab-case prop value.
        'selector-class-pattern': [
            '^(m-[a-z][a-zA-Z0-9-]*|[a-z][a-zA-Z0-9]*(__[a-z][a-z0-9-]*)?)$',
            { message: 'Use .componentName, .componentName__element-name, or .m-modifier.' },
        ],
        // Colours come from tokens.scss, never from literals in a component or route.
        'color-no-hex': true,
        'function-disallowed-list': ['rgb', 'rgba', 'hsl', 'hsla'],
        // Font names in the tokens and SVG keywords such as currentColor keep their case.
        'value-keyword-case': [
            'lower',
            { camelCaseSvgKeywords: true, ignoreProperties: ['/^--font/'] },
        ],
        // `clip` stays beside `clip-path` in the visually-hidden pattern for older engines.
        'property-no-deprecated': [true, { ignoreProperties: ['clip'] }],
        // It reads the slash in `font: size/line-height` as division.
        'scss/operator-no-unspaced': null,
    },
    overrides: [
        {
            files: ['apps/frontend/src/styles/tokens.scss'],
            rules: { 'color-no-hex': null, 'function-disallowed-list': null },
        },
        {
            // The internal galleries (404 in production) keep their exploratory backdrops.
            files: ['apps/frontend/src/app/[(]internal[)]/**'],
            rules: { 'function-disallowed-list': null },
        },
        {
            // The global utility keeps its conventional name, and reduced motion must override
            // every component transition.
            files: ['apps/frontend/src/styles/globals.scss'],
            rules: { 'selector-class-pattern': null, 'declaration-no-important': null },
        },
    ],
};
