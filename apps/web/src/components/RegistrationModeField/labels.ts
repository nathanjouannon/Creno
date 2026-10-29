import type { RegistrationMode } from '@/lib/api-types';

/** Names of the registration modes on screen (glossary, RG-19). */
export const registrationModeLabels: Record<RegistrationMode, string> = {
  FIXED: 'Créneaux fixes',
  FREE: 'Créneaux libres',
  BOTH: 'Les deux',
};
