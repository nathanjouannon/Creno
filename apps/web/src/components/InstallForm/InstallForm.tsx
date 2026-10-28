'use client';

import { setupInputSchema } from '@creno/validation';
import { useRouter } from 'next/navigation';
import { Form } from '@/components/Form';
import { FormField } from '@/components/FormField';
import { EmailInput, PasswordInput, SelectInput, TextInput } from '@/components/Input';
import { PrivacyNotice } from '@/components/PrivacyNotice';
import { postJson } from '@/lib/api-client';

interface Props {
  timezones: readonly string[];
}

const defaultValues = {
  club: { name: '', timezone: 'Europe/Paris' },
  admin: { firstName: '', lastName: '', email: '', password: '' },
};

/** A10, A11 (F-19, RG-17): club, then first administrator. Usable once; "not found" afterwards. */
export function InstallForm({ timezones }: Props) {
  const router = useRouter();

  return (
    <Form
      schema={setupInputSchema}
      defaultValues={defaultValues}
      submitLabel="Installer"
      onSubmit={async (values) => {
        const result = await postJson('/api/setup', values);
        if (result.ok) {
          router.push('/events');
        } else if (result.error.code === 'NOT_FOUND') {
          // RG-17: another installation was faster; the page is gone now
          window.location.assign('/installation');
        }
        return result;
      }}
    >
      <fieldset className="flex flex-col gap-md">
        <legend className="mb-sm text-large font-medium">Le club</legend>
        <FormField name="club.name" label="Nom du club" required>
          <TextInput autoComplete="organization" />
        </FormField>
        <FormField name="club.timezone" label="Fuseau horaire" required>
          <SelectInput options={timezones} />
        </FormField>
      </fieldset>
      <fieldset className="flex flex-col gap-md">
        <legend className="mb-sm text-large font-medium">Premier administrateur</legend>
        <FormField name="admin.lastName" label="Nom" required>
          <TextInput autoComplete="family-name" />
        </FormField>
        <FormField name="admin.firstName" label="Prénom" required>
          <TextInput autoComplete="given-name" />
        </FormField>
        <FormField name="admin.email" label="E-mail" required>
          <EmailInput />
        </FormField>
        <FormField
          name="admin.password"
          label="Mot de passe"
          help="10 caractères au minimum."
          required
        >
          <PasswordInput autoComplete="new-password" />
        </FormField>
      </fieldset>
      <PrivacyNotice />
    </Form>
  );
}
