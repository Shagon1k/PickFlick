/** Stable `vMAJOR.MINOR.PATCH` release tags and their semantic ordering. */

export const stableVersionPattern = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export const releaseTypes = new Set(['major', 'minor', 'patch']);

export function parseVersion(version) {
    const match = stableVersionPattern.exec(version);
    return match ? match.slice(1).map((part) => BigInt(part)) : undefined;
}

export function compareVersions(left, right) {
    for (let index = 0; index < left.length; index += 1) {
        if (left[index] > right[index]) {
            return 1;
        }
        if (left[index] < right[index]) {
            return -1;
        }
    }
    return 0;
}

export function highestStableVersion(tags) {
    return tags
        .map((tag) => ({ parsed: parseVersion(tag), tag }))
        .filter(({ parsed }) => parsed !== undefined)
        .reduce(
            (current, candidate) =>
                current === undefined || compareVersions(candidate.parsed, current.parsed) > 0
                    ? candidate
                    : current,
            undefined,
        );
}

export function nextStableVersion(tags, releaseType) {
    if (!releaseTypes.has(releaseType)) {
        throw new Error('RELEASE_TYPE must be patch, minor, or major.');
    }
    const versions = tags.map(parseVersion).filter(Boolean);
    const latest = versions.reduce(
        (current, candidate) => (compareVersions(candidate, current) > 0 ? candidate : current),
        [0n, 0n, 0n],
    );
    let [major, minor, patch] = latest;
    if (releaseType === 'major') {
        major += 1n;
        minor = 0n;
        patch = 0n;
    } else if (releaseType === 'minor') {
        minor += 1n;
        patch = 0n;
    } else {
        patch += 1n;
    }
    return `v${major}.${minor}.${patch}`;
}
