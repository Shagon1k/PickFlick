const MILLISECONDS_PER_SECOND = 1000;

/** A motion token in milliseconds; CSS optimization may serialize `350ms` as `.35s`. */
export function readDurationToken(style: CSSStyleDeclaration, name: string): number {
    const value = style.getPropertyValue(name).trim();
    return Number.parseFloat(value) * (value.endsWith('ms') ? 1 : MILLISECONDS_PER_SECOND);
}
