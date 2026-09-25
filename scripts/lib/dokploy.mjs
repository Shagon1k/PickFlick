/** HTTP, revision, and Dokploy helpers shared by the UAT deploy and production promotion. */

const revisionPattern = /^[0-9a-f]{40}$/;

export function required(source, name) {
    const value = source[name]?.trim();
    if (!value) {
        throw new Error(`${name} is required.`);
    }
    return value;
}

export function validateRevision(value) {
    const revision = value?.trim().toLowerCase();
    if (!revisionPattern.test(revision ?? '')) {
        throw new Error('SOURCE_REVISION must be a full 40-character hexadecimal Git SHA.');
    }
    return revision;
}

export function requestHeaders(authentication) {
    return {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...authentication,
    };
}

export function dokployAuthentication(configuration) {
    return {
        'CF-Access-Client-Id': configuration.cloudflareAccessClientId,
        'CF-Access-Client-Secret': configuration.cloudflareAccessClientSecret,
        'x-api-key': configuration.dokployApiToken,
    };
}

export async function requestJson(fetchImplementation, url, options, acceptedStatuses = [200]) {
    let response;
    try {
        response = await fetchImplementation(url, {
            ...options,
            signal: AbortSignal.timeout(15_000),
        });
    } catch (error) {
        throw new Error(`Request to ${new URL(url).pathname} failed.`, { cause: error });
    }

    if (!acceptedStatuses.includes(response.status)) {
        throw new Error(`Request to ${new URL(url).pathname} returned HTTP ${response.status}.`);
    }
    if (response.status === 204) {
        return undefined;
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
        throw new Error(`Request to ${new URL(url).pathname} did not return JSON.`);
    }
    return response.json();
}

export function dokployUrl(origin, path) {
    return new URL(path, `${origin}/`).href;
}

export function canonicalComposePath(path) {
    return typeof path === 'string' ? path.trim().replace(/^\.\/+/, '') : path;
}
