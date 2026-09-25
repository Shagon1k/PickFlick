import { UnsupportedMediaTypeException } from '@nestjs/common';

interface RequestWithHeaders {
    readonly headers?: Readonly<Record<string, string | string[] | undefined>>;
}

/** Rejects a mutation whose body is not declared as JSON before it reaches validation. */
export function assertJsonBody(request: RequestWithHeaders): void {
    const contentType = request.headers?.['content-type'];
    const mediaType =
        typeof contentType === 'string'
            ? contentType.split(';', 1)[0]?.trim().toLowerCase()
            : undefined;
    if (mediaType !== 'application/json') {
        throw new UnsupportedMediaTypeException();
    }
}
