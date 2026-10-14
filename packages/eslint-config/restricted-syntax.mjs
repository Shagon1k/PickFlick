// Syntax rules shared by the ESLint config; each selector enforces one house convention.

const noReadonlyWrapper = {
    selector: "TSTypeReference[typeName.name='Readonly']",
    message: 'Write plain types; props and data are not wrapped in Readonly<>.',
};

// Module-level constants set from a literal are UPPER_SNAKE_CASE. Values computed at runtime and the
// export names Next.js requires (alt, contentType, ...) keep camelCase.
const constantNaming = {
    selector: [
        ":matches(Program, Program > ExportNamedDeclaration) > VariableDeclaration[kind='const']",
        "> VariableDeclarator[id.type='Identifier']",
        ':matches([init.type=/^(Literal|TemplateLiteral)$/],',
        " [init.type='BinaryExpression']:not(:has(CallExpression, MemberExpression)))",
        // A boolean constant follows the boolean naming rule instead (`isEnabled`).
        ':not([init.raw=/^(true|false)$/])',
        ':not([id.name=/^[A-Z][A-Z0-9_]*$/])',
        ':not([id.name=/^(alt|contentType|dynamic|revalidate|runtime)$/])',
    ].join(''),
    message: 'Name a module-level literal constant in UPPER_SNAKE_CASE.',
};

// A number inside logic gets a name. Module-level constant initializers may hold numbers, so
// arithmetic and schema limits stay readable (`7 * DAY_MS`, `.max(200)`); 0, 1 and 2, default
// values, enum members, literal types and computed indexes are exempt. Tests keep literal
// expectations.
const NUMBER_LITERAL = 'Literal[raw=/^[0-9]/]:not([raw=/^[0-2]$/])';
const EXEMPT_NUMBER = [
    ':not(AssignmentPattern > Literal.right)',
    ':not(MemberExpression[computed=true] > Literal.property)',
    ':not(TSLiteralType Literal)',
    ':not(TSEnumMember Literal)',
].join('');
const MAGIC_NUMBER_MESSAGE = 'Name this number as a module-level UPPER_SNAKE_CASE constant.';
const magicNumbers = [
    { selector: `:function ${NUMBER_LITERAL}${EXEMPT_NUMBER}`, message: MAGIC_NUMBER_MESSAGE },
    {
        selector: [
            NUMBER_LITERAL,
            EXEMPT_NUMBER,
            ':not(:function Literal)',
            ':not(Program > VariableDeclaration Literal)',
            ':not(Program > ExportNamedDeclaration > VariableDeclaration Literal)',
            ':not(PropertyDefinition > Literal.value)',
        ].join(''),
        message: MAGIC_NUMBER_MESSAGE,
    },
];

const frontendSyntax = [
    {
        // A component's own event handler is handleX; a forwarded prop is onX and a state setter
        // is setX.
        selector:
            'JSXAttribute[name.name=/^on[A-Z]/] > JSXExpressionContainer > Identifier[name!=/^(handle|on|set)[A-Z]/]',
        message: 'Name an event handler handleX (or pass an onX prop or setX setter).',
    },
    {
        selector: 'ExportNamedDeclaration > FunctionDeclaration[id.name=/^[A-Z]/]',
        message:
            'Export a component as the default export of its own file (export default function Name).',
    },
];

/**
 * The `no-restricted-syntax` entry for one group of files. A flat config that restates the rule
 * replaces it entirely, so every group builds its list here.
 */
export function restrictedSyntax({ withNumbers = false, withFrontend = false } = {}) {
    return [
        'error',
        noReadonlyWrapper,
        constantNaming,
        ...(withNumbers ? magicNumbers : []),
        ...(withFrontend ? frontendSyntax : []),
    ];
}
