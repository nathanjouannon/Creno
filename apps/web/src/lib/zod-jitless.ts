import { z } from 'zod';

// security.md, section 4 (#80): Zod 4 compiles its parsers with `new Function`, which the Content-Security-Policy
// (no `unsafe-eval`) forbids and the browser reports as a violation even when Zod catches the error. `jitless` makes
// Zod skip that probe. Import this module before any schema used in the browser.
z.config({ jitless: true });
