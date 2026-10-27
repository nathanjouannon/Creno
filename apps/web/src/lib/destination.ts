/**
 * Page to go back to after signing in (flow 02, scenario "retour à la page demandée"). It comes from the address of
 * the sign-in page, so it is checked: only a path of this application is accepted, never another site.
 */
const FORBIDDEN_PREFIXES = ['/connexion', '/installation', '/api'];

export function safeDestination(value: string | null | undefined): string | null {
  if (!value || value.length > 500) return null;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;
  if ([...value].some((char) => char.charCodeAt(0) < 32 || char === '\u007f' || char === '\\'))
    return null;
  if (
    FORBIDDEN_PREFIXES.some(
      (prefix) =>
        value === prefix || value.startsWith(`${prefix}/`) || value.startsWith(`${prefix}?`),
    )
  ) {
    return null;
  }
  return value;
}
