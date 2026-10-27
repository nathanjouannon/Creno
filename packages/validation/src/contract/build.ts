import { buildErrorsJson, buildErrorsMarkdown } from './errors-docs';
import { buildOpenApiYaml } from './openapi';

/** Every generated contract file, by file name in `docs/api/`. */
export function buildArtifacts(): Record<'openapi.yaml' | 'errors.json' | 'errors.md', string> {
  return {
    'openapi.yaml': buildOpenApiYaml(),
    'errors.json': buildErrorsJson(),
    'errors.md': buildErrorsMarkdown(),
  };
}
