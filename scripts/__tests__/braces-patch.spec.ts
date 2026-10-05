import { createRequire } from 'node:module';

import compatibility from '../security/braces-compatibility.json';

interface INode {
    type: string;
    nodes?: INode[];
    value?: string;
}
interface IBraces {
    (input: string | string[], options?: object): unknown;
    parse(input: string, options?: object): INode;
    compile(input: string | INode, options?: object): unknown;
    expand(input: string | INode, options?: object): unknown;
    stringify(input: string | INode, options?: object): unknown;
}
const require = createRequire(import.meta.url);
// Follow the installed toolchain resolver, not orphaned patch caches or pnpm's internal hash format.
const stylelintRequire = createRequire(require.resolve('stylelint'));
const micromatchRequire = createRequire(stylelintRequire.resolve('micromatch'));
// CommonJS package has no types; its public API is checked at this library boundary.
const braces = micromatchRequire('braces') as IBraces;
const modes = ['compile', 'expand', 'stringify'] as const;
const nested = (open: string, close: string, depth: number) =>
    open.repeat(depth) + 'a,b' + close.repeat(depth);
const depthError = { name: 'SyntaxError', message: 'Input nesting exceeds maximum depth (100)' };

function ast(depth: number): INode {
    let node: INode = { type: 'text', value: 'safe' };
    for (let index = 0; index < depth; index++) {
        node = { type: 'paren', nodes: [node] };
    }
    return { type: 'root', nodes: [node] };
}

describe('patched braces', () => {
    // Captured from unmodified braces@3.0.3: escaping, quotes, brackets, ranges and malformed input.
    it.each(compatibility)('should preserve original results for $pattern', (fixture) => {
        for (const mode of modes) {
            expect(braces[mode](fixture.pattern)).toEqual(fixture[mode]);
        }
    });

    it.each([
        ['{', '}'],
        ['(', ')'],
        ['({', '})'],
    ])('should allow exactly 100 AST containers for %s', (open, close) => {
        const depth = 100 / open.length;
        for (const mode of modes) {
            expect(() => braces[mode](nested(open, close, depth))).not.toThrow();
            expect(() =>
                braces[mode](nested(open, close, depth) + nested(open, close, depth)),
            ).not.toThrow();
        }
    });

    it.each([
        nested('{', '}', 101),
        nested('(', ')', 101),
        nested('({', '})', 51),
        nested('{', '}', 4998),
        nested('(', ')', 4997),
        '{'.repeat(101),
        '('.repeat(101),
        '({'.repeat(51),
        '{('.repeat(51) + '})'.repeat(51),
    ])('should reject deep or unclosed input before walking (%#)', (pattern) => {
        for (const mode of ['parse', ...modes] as const) {
            expect(() => braces[mode](pattern)).toThrow(depthError.message);
        }
        expect(() => braces(pattern)).toThrow(depthError.message);
        expect(() => braces(['safe', pattern], { expand: true })).toThrow(depthError.message);
        expect(() => braces.expand(pattern, { maxDepth: Infinity })).toThrow(depthError.message);
    });

    it.each(['"', "'", '`'])('should treat deeply nested quoted text as literal (%s)', (quote) => {
        const text = nested('{(', ')}', 101);
        expect(braces.stringify(quote + text + quote)).toBe(text);
        expect(braces.stringify(quote + text + quote, { keepQuotes: true })).toBe(
            quote + text + quote,
        );
    });

    it('should treat brackets and escaped delimiters as literal without consuming depth', () => {
        const bracket = '[' + nested('{(', ')}', 101) + ']';
        expect(braces.stringify(bracket)).toBe(bracket);
        const escaped = '\\{\\('.repeat(101);
        expect(braces.stringify(escaped)).toBe('{('.repeat(101));
        expect(braces.stringify(escaped, { keepEscaping: true })).toBe(escaped);
    });

    it.each(modes)('should bound caller ASTs before %s mutates or walks them', (mode) => {
        expect(() => braces[mode](ast(100))).not.toThrow();
        const deep = ast(101);
        const before = JSON.stringify(deep);
        expect(() => braces[mode](deep)).toThrow(depthError.message);
        expect(JSON.stringify(deep)).toBe(before);
        expect(() => braces[mode](ast(10000))).toThrow(depthError.message);
    });

    it.each(modes)('should reject child cycles but allow shared child nodes in %s', (mode) => {
        const cycle: INode = { type: 'root', nodes: [] };
        cycle.nodes!.push(cycle);
        expect(() => braces[mode](cycle)).toThrow('Cyclic braces AST');
        const shared: INode = { type: 'paren', nodes: [{ type: 'text', value: 'safe' }] };
        expect(() => braces[mode]({ type: 'root', nodes: [shared, shared] })).not.toThrow();
    });

    it.each(modes)('should bound shared graphs and broad caller ASTs in %s', (mode) => {
        let graph: INode = { type: 'text', value: 'safe' };
        for (let depth = 0; depth < 25; depth++) {
            graph = { type: 'root', nodes: [graph, graph] };
        }
        expect(() => braces[mode](graph)).toThrow('Input AST exceeds maximum work (200000)');
        expect(() =>
            braces[mode]({
                type: 'root',
                nodes: Array<INode>(200001).fill({ type: 'text', value: 'safe' }),
            }),
        ).toThrow('Input AST exceeds maximum work (200000)');
        expect(() => braces[mode]('a'.repeat(10000))).not.toThrow();
    });

    it.each(modes)('should keep parsed AST caller behavior in %s', (mode) => {
        const pattern = 'foo/{a,(b)}/bar';
        expect(braces[mode](braces.parse(pattern))).toEqual(braces[mode](pattern));
    });
});
