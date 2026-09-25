import {
    CLUB_DESCRIPTION_MAX_LENGTH,
    CLUB_NAME_MAX_LENGTH,
    CLUB_NAME_MIN_LENGTH,
} from '@pickflick/contracts';

import { ClubValidationError } from './club.errors.js';
import type { NormalizedCreateClubInput } from './club-onboarding.types.js';

function containsUnsafeControlCharacter(value: string): boolean {
    return [...value].some((character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return (codePoint < 32 && codePoint !== 9 && codePoint !== 10) || codePoint === 127;
    });
}

export function parseCreateClubInput(value: unknown): NormalizedCreateClubInput {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new ClubValidationError('Club creation input must be an object.');
    }

    const input = value as Record<string, unknown>;
    const allowedFields = ['name', 'description', 'selectionScaleMin', 'selectionScaleMax'];
    if (Object.keys(input).some((key) => !allowedFields.includes(key))) {
        throw new ClubValidationError('Club creation input contains an unsupported field.');
    }

    if (typeof input.name !== 'string') {
        throw new ClubValidationError('Club name is required.');
    }
    const name = input.name.trim();
    if (
        name.length < CLUB_NAME_MIN_LENGTH ||
        name.length > CLUB_NAME_MAX_LENGTH ||
        containsUnsafeControlCharacter(name) ||
        /[\r\n]/u.test(name)
    ) {
        throw new ClubValidationError('Club name is invalid.');
    }

    let description: string | undefined;
    if (input.description !== undefined && input.description !== null && input.description !== '') {
        if (typeof input.description !== 'string') {
            throw new ClubValidationError('Club description must be text.');
        }
        description = input.description.replace(/\r\n?/gu, '\n').trim();
        if (
            description.length > CLUB_DESCRIPTION_MAX_LENGTH ||
            containsUnsafeControlCharacter(description)
        ) {
            throw new ClubValidationError('Club description is invalid.');
        }
        if (!description) {
            description = undefined;
        }
    }

    if (
        (input.selectionScaleMin !== 0 && input.selectionScaleMin !== 1) ||
        !Number.isInteger(input.selectionScaleMax) ||
        (input.selectionScaleMax as number) < 1 ||
        (input.selectionScaleMax as number) > 10 ||
        (input.selectionScaleMax as number) <= input.selectionScaleMin
    ) {
        throw new ClubValidationError(
            'Selection scale must be an inclusive 0..N or 1..N range through 10.',
        );
    }

    return {
        name,
        ...(description ? { description } : {}),
        selectionScaleMin: input.selectionScaleMin,
        selectionScaleMax: input.selectionScaleMax as number,
    };
}
