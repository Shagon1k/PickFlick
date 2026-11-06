import { BadRequestException, ParseUUIDPipe, type PipeTransform } from '@nestjs/common';
import { z } from 'zod';

/** Parses a request body with a contracts schema: `@Body(new ZodValidationPipe(schema))`. */
export class ZodValidationPipe<TSchema extends z.ZodType> implements PipeTransform {
    constructor(private readonly schema: TSchema) {}

    transform(value: unknown): z.infer<TSchema> {
        const result = this.schema.safeParse(value);
        if (!result.success) {
            throw new BadRequestException();
        }
        return result.data;
    }
}

/** Endpoints that take no input reject stray fields, so `?userId=other` never looks accepted. */
export const EMPTY_REQUEST = new ZodValidationPipe(z.strictObject({}));

/** Route IDs are database-generated v4 UUIDs: `@Param('clubId', UUID_PARAM)`. */
export const UUID_PARAM = new ParseUUIDPipe({ version: '4' });
