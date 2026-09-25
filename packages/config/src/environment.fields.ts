import type {
    DeploymentEnvironment,
    EnvironmentSource,
    ValidationFailure,
} from './environment.types.js';

// Domain labels exclude dots, so matching stays linear instead of backtracking over the domain.
const emailAddressPattern = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/u;

export function isEmailAddress(value: string): boolean {
    return emailAddressPattern.test(value);
}

/** `local@domain.tld` or `Display Name <local@domain.tld>`. */
export function isMailbox(value: string): boolean {
    if (isEmailAddress(value)) {
        return true;
    }
    const open = value.lastIndexOf(' <');
    return (
        open > 0 &&
        value.endsWith('>') &&
        !/[@<>\r\n]/u.test(value.slice(0, open)) &&
        isEmailAddress(value.slice(open + 2, -1))
    );
}

export function required(
    source: EnvironmentSource,
    name: string,
    failures: ValidationFailure[],
): string {
    const value = source[name]?.trim();
    if (!value) {
        failures.push({ name, reason: 'is required' });
        return '';
    }
    return value;
}

export function oneOf<T extends readonly string[]>(
    source: EnvironmentSource,
    name: string,
    values: T,
    failures: ValidationFailure[],
): T[number] {
    const value = required(source, name, failures);
    if (value && !values.includes(value)) {
        failures.push({ name, reason: `must be one of ${values.join(', ')}` });
    }
    return value as T[number];
}

export function integer(
    source: EnvironmentSource,
    name: string,
    failures: ValidationFailure[],
): number {
    const value = required(source, name, failures);
    const parsed = Number(value);
    if (value && (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535)) {
        failures.push({ name, reason: 'must be an integer from 1 through 65535' });
    }
    return parsed;
}

export function durationMilliseconds(
    source: EnvironmentSource,
    name: string,
    failures: ValidationFailure[],
): number {
    const value = required(source, name, failures);
    const parsed = Number(value);
    if (value && (!Number.isInteger(parsed) || parsed < 1 || parsed > 86_400_000)) {
        failures.push({ name, reason: 'must be an integer from 1 through 86400000' });
    }
    return parsed;
}

export function boolean(
    source: EnvironmentSource,
    name: string,
    failures: ValidationFailure[],
): boolean {
    const value = required(source, name, failures);
    if (value && value !== 'true' && value !== 'false') {
        failures.push({ name, reason: 'must be true or false' });
    }
    return value === 'true';
}

export function optionalBoolean(
    source: EnvironmentSource,
    name: string,
    failures: ValidationFailure[],
): boolean {
    const value = source[name]?.trim();
    if (!value) {
        return false;
    }
    if (value !== 'true' && value !== 'false') {
        failures.push({ name, reason: 'must be true or false' });
    }
    return value === 'true';
}

export function url(
    source: EnvironmentSource,
    name: string,
    protocols: readonly string[],
    failures: ValidationFailure[],
    structure?: 'host' | 'host-and-path',
): string {
    const value = required(source, name, failures);
    if (!value) {
        return value;
    }
    try {
        const parsed = new URL(value);
        if (!protocols.includes(parsed.protocol)) {
            failures.push({ name, reason: `must use ${protocols.join(' or ')}` });
        }
        if (structure && !parsed.hostname) {
            failures.push({ name, reason: 'must include a host' });
        }
        if (structure === 'host-and-path' && (!parsed.pathname || parsed.pathname === '/')) {
            failures.push({ name, reason: 'must include a database name' });
        }
    } catch {
        failures.push({ name, reason: 'must be a valid URL' });
    }
    return value;
}

export function originUrl(
    source: EnvironmentSource,
    name: string,
    appEnvironment: DeploymentEnvironment,
    failures: ValidationFailure[],
): string {
    const value = url(source, name, ['http:', 'https:'], failures, 'host');
    if (!value) {
        return value;
    }
    try {
        const parsed = new URL(value);
        if (
            parsed.pathname !== '/' ||
            parsed.search ||
            parsed.hash ||
            parsed.username ||
            parsed.password
        ) {
            failures.push({
                name,
                reason: 'must be an origin without credentials, path, query, or fragment',
            });
        }
        if (
            (appEnvironment === 'uat' || appEnvironment === 'production') &&
            parsed.protocol !== 'https:'
        ) {
            failures.push({ name, reason: 'must use https in uat or production' });
        }
        return parsed.origin;
    } catch {
        return value;
    }
}
