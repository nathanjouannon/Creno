'use client';

import { acceptInvitationInputSchema } from '@creno/validation';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/Button';
import { Form } from '@/components/Form';
import { FormField } from '@/components/FormField';
import { EmailInput, PasswordInput, TextInput } from '@/components/Input';
import { useToast } from '@/components/Toast';
import { postJson } from '@/lib/api-client';

interface Props {
  token: string;
  /** The event the link comes from: where to go once signed in, or after signing in instead (flow 01). */
  eventId: number;
}

const defaultValues = { lastName: '', firstName: '', email: '', password: '' };
const IDENTITY_FIELDS = ['lastName', 'firstName', 'email'];
const MISSING_IDENTITY = 'Renseigne ton nom, ton prénom et une adresse e-mail valide';

/**
 * A1 to A3 (F-01, RG-01, RG-02). A missing or malformed name or address is one toast and the fields stay filled;
 * a short password is shown under its field; an address already used offers the sign-in page, which sends back
 * to the event of the link (`suite`).
 */
export function InvitationSignupForm({ token, eventId }: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const [emailTaken, setEmailTaken] = useState(false);
  const toIdentityToast = (fields: string[]) => {
    if (fields.some((field) => IDENTITY_FIELDS.includes(field)))
      showToast({ tone: 'danger', message: MISSING_IDENTITY });
  };

  return (
    <Form
      schema={acceptInvitationInputSchema}
      defaultValues={defaultValues}
      submitLabel="Créer mon compte"
      onInvalid={toIdentityToast}
      onSubmit={async (values) => {
        setEmailTaken(false);
        const result = await postJson(`/api/invitations/${encodeURIComponent(token)}`, values);
        if (result.ok) {
          // Full load: the page of the event is read with the new session
          window.location.assign(`/events/${eventId}`);
        } else if (result.error.code === 'USER_EMAIL_TAKEN') {
          setEmailTaken(true);
        } else if (result.error.code === 'VALIDATION_ERROR') {
          toIdentityToast(result.error.details?.fields?.map(({ field }) => field) ?? []);
        } else if (result.error.code === 'INVITATION_INVALID') {
          // The link expired while the form was open: the page now says so
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
        <EmailInput autoComplete="username" />
      </FormField>
      <FormField name="password" label="Mot de passe" help="10 caractères au minimum." required>
        <PasswordInput autoComplete="new-password" />
      </FormField>
      {emailTaken ? (
        <Button
          variant="secondary"
          onClick={() =>
            router.push(`/connexion?suite=${encodeURIComponent(`/events/${eventId}`)}`)
          }
        >
          Aller à la connexion
        </Button>
      ) : null}
    </Form>
  );
}
