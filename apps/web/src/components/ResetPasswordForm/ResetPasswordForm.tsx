'use client';

import { resetPasswordInputSchema } from '@creno/validation';
import { useRouter } from 'next/navigation';
import { Form } from '@/components/Form';
import { FormField } from '@/components/FormField';
import { PasswordInput } from '@/components/Input';
import { useToast } from '@/components/Toast';
import { postJson } from '@/lib/api-client';

const defaultValues = { password: '' };

/**
 * A8 (F-02, RG-01, RG-12). No session is opened by the reset: the user is sent to the sign-in page with a
 * confirmation. A link that became invalid meanwhile is shown by the page (A9) after a refresh.
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const { showToast } = useToast();

  return (
    <Form
      schema={resetPasswordInputSchema}
      defaultValues={defaultValues}
      submitLabel="Enregistrer"
      resetOnError={['password']}
      onSubmit={async (values) => {
        const result = await postJson(`/api/password-resets/${encodeURIComponent(token)}`, values);
        if (result.ok) {
          showToast({ tone: 'success', message: 'Mot de passe changé. Connecte-toi.' });
          router.push('/connexion');
        } else if (result.error.code === 'AUTH_RESET_LINK_INVALID') {
          router.refresh();
        }
        return result;
      }}
    >
      <FormField
        name="password"
        label="Nouveau mot de passe"
        help="10 caractères au minimum."
        required
      >
        <PasswordInput autoComplete="new-password" />
      </FormField>
    </Form>
  );
}
