import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// Adds `.openapi('Name')` to Zod schemas: a name makes a schema a reusable component of the generated contract (ADR-0014).
extendZodWithOpenApi(z);
