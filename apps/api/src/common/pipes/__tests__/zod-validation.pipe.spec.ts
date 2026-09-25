import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

import { ZodValidationPipe } from '../zod-validation.pipe.js';

describe('ZodValidationPipe', () => {
    const pipe = new ZodValidationPipe(z.strictObject({ name: z.string().trim() }));

    it('should return the parsed value', () => {
        expect(pipe.transform({ name: ' Club ' })).toEqual({ name: 'Club' });
    });

    it('should turn a schema failure into a 400', () => {
        expect(() => pipe.transform({ name: 'Club', extra: true })).toThrow(BadRequestException);
    });
});
