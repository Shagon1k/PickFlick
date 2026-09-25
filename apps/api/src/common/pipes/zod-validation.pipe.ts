import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

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
