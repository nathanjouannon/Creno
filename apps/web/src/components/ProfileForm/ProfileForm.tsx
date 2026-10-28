'use client';

import { updateProfileInputSchema } from '@creno/validation';
import { useRouter } from 'next/navigation';
import { useFormContext } from 'react-hook-form';
import { Form } from '@/components/Form';
import { FormField } from '@/components/FormField';
import { EmailInput, PasswordInput, TextInput } from '@/components/Input';
import { useToast } from '@/components/Toast';
import { patchJson } from '@/lib/api-client';
import type { User } from '@/lib/api-types';

interface Props {
  user: Pick<User, 'firstName' | 'lastName' | 'email'>;
}

/** RG-18: the current password is asked only when the typed address differs from the saved one. */
function CurrentPasswordField({ savedEmail }: { savedEmail: string }) {
  const { watch } = useFormContext();
  const typed = String(watch('email') ?? '').trim();
  if (typed === savedEmail) return null;
  return (
    <FormField
      name="currentPassword"
      label="Mot de passe actuel"
      help="Nécessaire pour changer d'e-mail."
      required
    >
      <PasswordInput autoComplete="current-password" />
    </FormField>
  );
}

/**
 * « Mon profil » (F-20, RG-18): name, first name and address, saved together. Errors of the API go under their
 * field (`VALIDATION_ERROR`, taken address); the saved values then come back from the server, which also refreshes
 * the first name of the header.
 */
export function ProfileForm({ user }: Props) {
  const router = useRouter();
  const { showToast } = useToast();

  return (
    <Form
      key={`${user.firstName}|${user.lastName}|${user.email}`}
      schema={updateProfileInputSchema}
      defaultValues={{
        lastName: user.lastName,
        firstName: user.firstName,
        email: user.email,
        currentPassword: '',
      }}
      submitLabel="Enregistrer"
      errorMap={{ USER_EMAIL_IN_USE: { field: 'email' } }}
      onSubmit={async (values) => {
        const result = await patchJson('/api/me', values);
        if (result.ok) {
          showToast({ tone: 'success', message: 'Profil enregistré' });
          // The page and the header are rendered on the server: read the new values
          router.refresh();
        }
        return result;
      }}
    >
      <FormField name="lastName" label="Nom" required>
        <TextInput autoComplete="family-name" />
      </FormField>
      <FormField name="firstName" label="Prénom" required>
        <TextInput autoComplete="given-name" />
      </FormField>
      <FormField name="email" label="E-mail" required>
        <EmailInput autoComplete="email" />
      </FormField>
      <CurrentPasswordField savedEmail={user.email} />
    </Form>
  );
}
