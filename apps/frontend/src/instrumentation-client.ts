import { z } from 'zod';

// Runs before any page code. The page CSP forbids eval, and zod probes for it with `new Function`
// when it builds a schema, which the browser reports as a violation even though zod falls back.
z.config({ jitless: true });
