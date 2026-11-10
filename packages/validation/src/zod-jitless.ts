import { z } from 'zod';

// security.md, section 4 (#80): Zod 4 compiles its parsers with `new Function`, which the Content-Security-Policy
// (no `unsafe-eval`) forbids and the browser reports as a violation even when Zod catches the error. `jitless` makes
// Zod skip that probe. The package entry imports this module first, so it runs before any schema is built (a schema probes once, when built).
z.config({ jitless: true });
