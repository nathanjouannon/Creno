'use client';

import { FIELD_MAX_LENGTH, loginInputSchema } from '@creno/validation';
import { useRouter } from 'next/navigation';
import { Form } from '@/components/Form';
import { FormField } from '@/components/FormField';
import { EmailInput, PasswordInput } from '@/components/Input';
import { postJson } from '@/lib/api-client';

interface Props {
  /** Page to open after signing in, already checked by the server (`safeDestination`). */
  destination: string | null;
}

const defaultValues = { email: '', password: '' };

/**
 * A5 to A7 (F-02, RG-03). One undetailed error for a wrong password, an unknown address or a deleted account;
 * the blocking message comes from the API. The password is emptied after any failure.
 */
export function LoginForm({ destination }: Props) {
  const router = useRouter();

  return (
    <Form
      schema={loginInputSchema}
      defaultValues={defaultValues}
      submitLabel="Se connecter"
      resetOnError={['password']}
      onSubmit={async (values) => {
        const result = await postJson('/api/auth/login', values);
        if (result.ok) router.push(destination ?? '/events');
        return result;
      }}
    >
      <FormField name="email" label="E-mail">
        <EmailInput autoComplete="username" maxLength={FIELD_MAX_LENGTH.email} />
      </FormField>
      <FormField name="password" label="Mot de passe">
        <PasswordInput autoComplete="current-password" maxLength={FIELD_MAX_LENGTH.password} />
      </FormField>
    </Form>
  );
}
